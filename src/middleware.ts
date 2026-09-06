import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ข้าม Static Assets และ Public Paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/login' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ดึง Session Cookie ที่ Better Auth สร้างขึ้น
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token');

  // ตรวจสอบการเข้าถึงหน้าที่มีการป้องกัน
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};