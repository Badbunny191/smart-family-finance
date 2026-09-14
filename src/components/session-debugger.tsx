'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';

/**
 * 🎯 DEBUG ONLY: ตรวจ session state, cookies, PWA context
 * ไม่แก้ config, ไม่แก้ cookie, ไม่แก้ auth
 * เก็บหลักฐานเท่านั้น
 */
export function SessionDebugger() {
  const { data: session, isPending, error } = useSession();
  const lastSessionJsonRef = useRef<string>('');
  const lastCookieLengthRef = useRef<number>(0);

  useEffect(() => {
    const log = (event: string, extra: Record<string, unknown> = {}) => {
      const cookies = document.cookie;
      const cookieList = cookies.split(';').map((c) => c.trim()).filter(Boolean);
      const cookieNames = cookieList.map((c) => c.split('=')[0]);

      // หา session cookie
      const sessionCookie = cookieList.find((c) =>
        c.startsWith('better-auth.session_token=')
      );
      const secureSessionCookie = cookieList.find((c) =>
        c.startsWith('__Secure-better-auth.session_token=')
      );

      console.log('[SESSION_DEBUG]', {
        event,
        // Session state
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionId: session?.session?.id ? 'present' : 'missing',
        sessionExpiresAt: session?.session?.expiresAt,
        sessionCreatedAt: session?.session?.createdAt,
        isPending,
        hasError: !!error,
        errorMessage: error?.message,
        // Cookie state
        hasSessionCookie: !!sessionCookie,
        hasSecureSessionCookie: !!secureSessionCookie,
        sessionCookieLength: sessionCookie?.length || 0,
        secureSessionCookieLength: secureSessionCookie?.length || 0,
        allCookieNames: cookieNames,
        totalCookies: cookieList.length,
        // PWA context
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isIOSStandalone: (navigator as { standalone?: boolean }).standalone === true,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        visibilityState: document.visibilityState,
        // Misc
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
        ...extra,
      });
    };

    // 1. Mount → log initial state
    log('MOUNT');

    // 2. Detect session state change
    const sessionJson = JSON.stringify({
      hasSession: !!session,
      userId: session?.user?.id,
      expiresAt: session?.session?.expiresAt,
    });
    if (sessionJson !== lastSessionJsonRef.current) {
      lastSessionJsonRef.current = sessionJson;
      log('SESSION_CHANGED');
    }

    // 3. Detect cookie change
    const currentCookieLength = document.cookie.length;
    if (currentCookieLength !== lastCookieLengthRef.current) {
      log('COOKIE_CHANGED', {
        previousLength: lastCookieLengthRef.current,
        currentLength: currentCookieLength,
      });
      lastCookieLengthRef.current = currentCookieLength;
    }

    // 4. Page lifecycle events
    const onPageShow = (e: PageTransitionEvent) => {
      log('PAGESHOW', { persisted: e.persisted });
    };
    const onVisibilityChange = () => {
      log('VISIBILITY_CHANGE');
    };
    const onFocus = () => log('WINDOW_FOCUS');
    const onBlur = () => log('WINDOW_BLUR');
    const onResume = () => log('RESUME');

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resume', onResume);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resume', onResume);
    };
  }, [session, isPending, error]);

  return null;
}
