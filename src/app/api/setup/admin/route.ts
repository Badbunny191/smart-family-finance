import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';

export const runtime = 'nodejs';

/**
 * Simple in-memory rate limiter for admin setup endpoint
 * Tracks failed attempts by IP address
 * Resets after a cooldown period
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes lockout after max attempts

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Clean up expired entries
  if (record && now > record.resetAt + LOCKOUT_MS) {
    rateLimitMap.delete(ip);
  }

  const current = rateLimitMap.get(ip);

  if (!current) {
    rateLimitMap.set(ip, { count: 1, resetAt: now });
    return { allowed: true };
  }

  if (now > current.resetAt + LOCKOUT_MS) {
    // Lockout expired, reset counter
    rateLimitMap.set(ip, { count: 1, resetAt: now });
    return { allowed: true };
  }

  if (now < current.resetAt + WINDOW_MS && current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt + LOCKOUT_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  current.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  // Get client IP (works for Cloudflare Workers)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  // Check rate limit
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken || request.headers.get('x-admin-setup-token') !== setupToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = await getD1();
  const db = getDb(d1);
  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);

  if (existingAdmin.length > 0) {
    return NextResponse.json({ error: 'An admin user already exists.' }, { status: 409 });
  }

  const body = (await request.json()) as { name?: string; email?: string; password?: string };
  if (!body.name || !body.email || !body.password || body.password.length < 8) {
    return NextResponse.json(
      { error: 'name, email and a password of at least 8 characters are required.' },
      { status: 400 }
    );
  }

  const auth = createAuth(d1);
  const result = await auth.api.signUpEmail({
    body: {
      name: body.name,
      email: body.email,
      password: body.password,
    },
  });

  if (!result.user) {
    return NextResponse.json({ error: 'Unable to create the admin user.' }, { status: 500 });
  }

  await db.update(users).set({ role: 'admin' }).where(eq(users.id, result.user.id));

  return NextResponse.json({
    id: result.user.id,
    email: result.user.email,
    role: 'admin',
  });
}