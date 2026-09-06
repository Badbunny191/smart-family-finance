import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
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