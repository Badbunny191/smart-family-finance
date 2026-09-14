import { NextRequest } from 'next/server';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';

export const runtime = 'nodejs';

function logAuthCall(request: NextRequest, stage: string) {
  const url = new URL(request.url);
  const rawCookieHeader = request.headers.get('cookie') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  console.log('[AUTH_API]', {
    stage,
    path: url.pathname,
    method: request.method,
    hasCookieHeader: !!rawCookieHeader,
    cookieHeaderLength: rawCookieHeader.length,
    cookieHeaderHasSessionToken: rawCookieHeader.includes('better-auth.session_token'),
    isIOS,
    referer: request.headers.get('referer'),
    secFetchMode: request.headers.get('sec-fetch-mode'),
    secFetchDest: request.headers.get('sec-fetch-dest'),
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  logAuthCall(request, 'get-entry');
  const auth = createAuth(await getD1());
  const response = await auth.handler(request);

  // Clone response เพื่ออ่าน body
  try {
    const cloned = response.clone();
    const contentType = cloned.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await cloned.json() as { user?: { id: string; email: string } };
      console.log('[AUTH_API_RESULT]', {
        stage: 'get-result',
        path: new URL(request.url).pathname,
        status: response.status,
        bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        hasSession: !!(body && typeof body === 'object' && 'user' in body && body.user),
        userId: body?.user?.id,
        userEmail: body?.user?.email,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.log('[AUTH_API_RESULT]', {
      stage: 'get-result-error',
      path: new URL(request.url).pathname,
      err: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
  }

  return response;
}

export async function POST(request: NextRequest) {
  logAuthCall(request, 'post-entry');
  const auth = createAuth(await getD1());
  const response = await auth.handler(request);

  // Clone response เพื่ออ่าน body
  try {
    const cloned = response.clone();
    const contentType = cloned.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await cloned.json() as { user?: { id: string; email: string } };
      console.log('[AUTH_API_RESULT]', {
        stage: 'post-result',
        path: new URL(request.url).pathname,
        status: response.status,
        bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        hasSession: !!(body && typeof body === 'object' && 'user' in body && body.user),
        userId: body?.user?.id,
        userEmail: body?.user?.email,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.log('[AUTH_API_RESULT]', {
      stage: 'post-result-error',
      path: new URL(request.url).pathname,
      err: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
  }

  return response;
}
