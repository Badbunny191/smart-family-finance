import { createAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const d1 = (process.env as unknown as { DB: D1Database }).DB;
  const auth = createAuth(d1);
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  const d1 = (process.env as unknown as { DB: D1Database }).DB;
  const auth = createAuth(d1);
  return auth.handler(request);
}