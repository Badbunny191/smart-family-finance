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
  const d1 = await getD1();
  const db = getDb(d1);
  const session = await createAuth(d1).api.getSession({ headers: request.headers });
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