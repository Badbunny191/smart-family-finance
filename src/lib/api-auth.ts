import { NextResponse, type NextRequest } from 'next/server';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb, type AppDatabase } from '@/db/client';

export async function getRequestContext(request: NextRequest): Promise<{
  db: AppDatabase;
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>>>;
}> {
  const d1 = await getD1();
  const db = getDb(d1);
  const session = await createAuth(d1).api.getSession({ headers: request.headers });
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return { db, session };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });
}

export function serverErrorResponse() {
  return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
}