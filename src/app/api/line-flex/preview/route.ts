/**
 * LINE Flex Preview API
 * GET /api/line-flex/preview
 * 
 * Returns LINE Flex Message JSON from REAL database data.
 * NO SAMPLE DATA - Real data only
 * 
 * SINGLE SOURCE OF TRUTH:
 * - Uses getLineNotificationMetrics() from line-cron-service.ts
 * - Uses toFlexMetrics() from line-flex-sender.ts
 * - Uses buildFlexMessage() from line-flex-builder.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import {
  buildFlexMessage,
  LineFlexMetrics,
} from '@/lib/line-flex-builder';
import { getLineNotificationMetrics, LineNotificationMetrics } from '@/lib/line-cron-service';
import { toFlexMetrics } from '@/lib/line-flex-sender';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Try to get D1 from Cloudflare context
  try {
    const d1 = await getD1();
    const db = getDb(d1);

    // Get metrics using shared function
    const metrics = await getLineNotificationMetrics(d1);
    
    // Convert to Flex metrics using shared function
    const flexMetrics: LineFlexMetrics = toFlexMetrics(metrics);
    
    // Build Flex Message
    const flexMessage = buildFlexMessage(flexMetrics, parseSettingsFromUrl(request.nextUrl.searchParams));

    return NextResponse.json({
      source: 'database',
      debug: {
        metricsToday: metrics.today,
      },
      metrics: flexMetrics,
      flexMessage,
    });
  } catch (error) {
    console.error('[Flex Preview] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Parse settings from URL query params.
 * 
 * Supports checkbox toggles (true/false):
 *   ?showToday=false&showOverdueReceive=false&showOverduePay=true&showPendingReceive=false&showPendingPay=true
 * 
 * Unknown params are ignored. Missing params default to `true` (show section).
 */
function parseSettingsFromUrl(params: URLSearchParams) {
  const boolKeys = [
    'showBalance',
    'showMonthly',
    'showToday',
    'showOverdueReceive',
    'showOverduePay',
    'showPendingReceive',
    'showPendingPay',
  ] as const;

  const settings: Record<string, boolean> = {};
  for (const k of boolKeys) {
    const v = params.get(k);
    if (v === null) {
      settings[k] = true; // default: visible
    } else {
      settings[k] = v !== 'false' && v !== '0';
    }
  }

  // sendTime: optional in URL, default to "08:00"
  const sendTime = params.get('sendTime') ?? '08:00';

  return {
    sendTime,
    showBalance: settings.showBalance,
    showMonthly: settings.showMonthly,
    showToday: settings.showToday,
    showOverdueReceive: settings.showOverdueReceive,
    showOverduePay: settings.showOverduePay,
    showPendingReceive: settings.showPendingReceive,
    showPendingPay: settings.showPendingPay,
  };
}
