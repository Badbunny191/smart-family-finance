import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🎯 DEBUG: ดึง cookie ทั้งหมดที่ browser ส่งมา (ไม่ log value)
  const allCookies = request.cookies.getAll();
  const cookieNames = allCookies.map((c) => c.name);

  const sessionCookie =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token');

  const hasCookie = !!sessionCookie;
  const sessionCookieName = sessionCookie?.name || null;
  const sessionCookieValueLength = sessionCookie?.value?.length || 0;

  // 🎯 DEBUG: ตรวจ PWA context
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const secFetchMode = request.headers.get('sec-fetch-mode');
  const secFetchDest = request.headers.get('sec-fetch-dest');

  console.log('[MIDDLEWARE]', {
    pathname,
    hasCookie,
    sessionCookieName,
    sessionCookieValueLength,
    allCookieNames: cookieNames,
    totalCookies: allCookies.length,
    isIOS,
    secFetchMode,
    secFetchDest,
    timestamp: new Date().toISOString(),
  });

  // ข้าม Static Assets และ Public Paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/login' ||
    pathname.includes('.')
  ) {
    console.error('[MIDDLEWARE_PASS]', {
      pathname,
      hasCookie,
      reason: 'skipped_public_or_static',
      timestamp: new Date().toISOString(),
    });
    return NextResponse.next();
  }

  // ตรวจสอบการเข้าถึงหน้าที่มีการป้องกัน
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', encodeURI(pathname));

    console.error('[MIDDLEWARE_REDIRECT]', {
      pathname,
      hasCookie,
      reason: 'no_session_cookie',
      target: loginUrl.pathname + loginUrl.search,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.redirect(loginUrl);
  }

  console.error('[MIDDLEWARE_PASS]', {
    pathname,
    hasCookie,
    reason: 'session_cookie_present',
    timestamp: new Date().toISOString(),
  });
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
