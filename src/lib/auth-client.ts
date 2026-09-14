import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});

// 🎯 DEBUG: log useSession state ทุกครั้งที่ component ใช้
// เพื่อ track client-side session detection
if (typeof window !== 'undefined') {
  // Hook เข้าไปใน React state ของ auth-client
  // ใช้ mutationObserver + setInterval polling แทน (เพราะ useSession เป็น hook)
  setInterval(() => {
    const cookies = document.cookie;
    const cookieList = cookies.split(';').map((c) => c.trim()).filter(Boolean);
    const sessionCookie = cookieList.find((c) =>
      c.startsWith('better-auth.session_token=')
    );
    const secureSessionCookie = cookieList.find((c) =>
      c.startsWith('__Secure-better-auth.session_token=')
    );

    // หา isStandalone (PWA mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;

    console.log('[USE_SESSION_TRACE]', {
      // Cookie presence (client-readable)
      hasSessionCookie: !!sessionCookie,
      hasSecureSessionCookie: !!secureSessionCookie,
      sessionCookieLength: sessionCookie?.length || 0,
      secureSessionCookieLength: secureSessionCookie?.length || 0,
      allCookieCount: cookieList.length,
      // PWA context
      isStandalone,
      visibilityState: document.visibilityState,
      url: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
  }, 5000); // log ทุก 5 วินาที — ดูว่า state เปลี่ยนตอนไหน
}

export const { signIn, signUp, signOut, useSession } = authClient;
