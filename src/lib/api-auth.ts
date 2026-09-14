import { NextResponse, type NextRequest } from 'next/server';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb, type AppDatabase } from '@/db/client';

/**
 * Custom error classes for API error handling
 * Using typed errors instead of string matching for better type safety
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'คุณไม่มีสิทธิ์ดำเนินการนี้') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends Error {
  constructor(public readonly errors: unknown) {
    super('VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Get request context including database and session
 * Throws UnauthorizedError if no valid session
 */
export async function getRequestContext(request: NextRequest): Promise<{
  db: AppDatabase;
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>>>;
}> {
  const totalStart = performance.now();

  // 🎯 DEBUG: log raw request info ก่อนทำอะไร
  const rawCookieHeader = request.headers.get('cookie') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  console.log('[GET_SESSION_CONTEXT_REQUEST]', {
    url: request.url,
    method: request.method,
    hasCookieHeader: !!rawCookieHeader,
    cookieHeaderLength: rawCookieHeader.length,
    cookieHeaderHasSessionToken: rawCookieHeader.includes('better-auth.session_token'),
    isIOS,
    timestamp: new Date().toISOString(),
  });

  const d1Start = performance.now();
  const d1 = await getD1();
  const d1Ms = performance.now() - d1Start;

  const db = getDb(d1);

  const authStart = performance.now();
  const auth = createAuth(d1);
  const authMs = performance.now() - authStart;

  const sessionStart = performance.now();
  const session = await auth.api.getSession({ headers: request.headers });
  const sessionMs = performance.now() - sessionStart;

  const totalMs = performance.now() - totalStart;

  // 🎯 DEBUG: log session resolution result
  console.log('[GET_SESSION_CONTEXT_RESULT]', {
    url: request.url,
    method: request.method,
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    sessionId: session?.session?.id ? 'present' : 'missing',
    sessionExpiresAt: session?.session?.expiresAt,
    sessionCreatedAt: session?.session?.createdAt,
    d1Ms: Math.round(d1Ms * 100) / 100,
    authMs: Math.round(authMs * 100) / 100,
    sessionMs: Math.round(sessionMs * 100) / 100,
    totalMs: Math.round(totalMs * 100) / 100,
    timestamp: new Date().toISOString(),
  });

  if (!session) {
    throw new UnauthorizedError();
  }
  return { db, session };
}

/**
 * Check if user has admin role
 */
export function isAdmin(session: Awaited<ReturnType<typeof getRequestContext>>['session']): boolean {
  return (session.user as { role?: string }).role === 'admin';
}

/**
 * Response helpers
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
}

export function forbiddenResponse(message?: string) {
  return NextResponse.json({ error: message || 'คุณไม่มีสิทธิ์ดำเนินการนี้' }, { status: 403 });
}

export function serverErrorResponse(error?: Error) {
  // Log error details for debugging (in production, use proper logging service)
  if (process.env.NODE_ENV === 'development' && error) {
    console.error('[API Error]', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
  return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
}

/**
 * Handle API errors with type-safe error classes
 */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return unauthorizedResponse();
  }
  if (error instanceof ForbiddenError) {
    return forbiddenResponse(error.message);
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.errors }, { status: 400 });
  }
  if (error instanceof Error) {
    return serverErrorResponse(error);
  }
  return serverErrorResponse();
}
