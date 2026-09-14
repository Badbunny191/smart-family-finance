import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';

export const runtime = 'nodejs';

export default async function HomePage() {
  const requestHeaders = await headers();
  const h = Object.fromEntries(requestHeaders.entries());
  const cookieHeader = h['cookie'] || '';
  const userAgent = h['user-agent'] || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  const d1 = await getD1();
  const session = await createAuth(d1).api.getSession({ headers: requestHeaders });

  console.error('[HOME_PAGE_SESSION]', {
    hasSession: !!session,
    userId: session?.user?.id,
    sessionId: session?.session?.id,
    timestamp: new Date().toISOString(),
  });

  console.log('[REDIRECT_TRACE]', {
    source: 'src/app/page.tsx (HomePage)',
    hasCookieHeader: !!cookieHeader,
    cookieHeaderLength: cookieHeader.length,
    cookieHeaderHasSessionToken: cookieHeader.includes('better-auth.session_token'),
    isIOS,
    secFetchMode: h['sec-fetch-mode'],
    secFetchDest: h['sec-fetch-dest'],
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    sessionExpiresAt: session?.session?.expiresAt,
    target: session ? '/dashboard' : '/login',
    timestamp: new Date().toISOString(),
  });

  if (session) {
    console.error('[HOME_PAGE_REDIRECT]', {
      target: '/dashboard',
      reason: 'session_exists',
      timestamp: new Date().toISOString(),
    });
    redirect('/dashboard');
  }
  console.error('[HOME_PAGE_REDIRECT]', {
    target: '/login',
    reason: 'session_null',
    timestamp: new Date().toISOString(),
  });
  redirect('/login');
}
