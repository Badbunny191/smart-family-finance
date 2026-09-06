import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = createAuth(await getD1());
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  const auth = createAuth(await getD1());
  return auth.handler(request);
}