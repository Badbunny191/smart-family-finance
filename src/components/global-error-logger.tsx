'use client';

import { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';

export function GlobalErrorLogger() {
  const pathname = usePathname();
  const params = useParams();
  const accountId = (params?.id as string) ?? null;

  useEffect(() => {
    const timestamp = () => new Date().toISOString();
    const context = () => ({ pathname, accountId, timestamp: timestamp() });

    // window.onerror handler
    const onError = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
      console.error('[GLOBAL_ERROR]', {
        type: 'window.onerror',
        message: typeof message === 'string' ? message : 'Event',
        source,
        lineno,
        colno,
        errorName: error?.name,
        errorMessage: error?.message,
        ...context(),
      });
    };

    // unhandledrejection handler
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      console.error('[GLOBAL_ERROR]', {
        type: 'unhandledrejection',
        reason: reason instanceof Error ? reason.message : String(reason),
        errorName: reason instanceof Error ? reason.name : undefined,
        stack: reason instanceof Error ? reason.stack : undefined,
        ...context(),
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [pathname, accountId]);

  return null;
}
