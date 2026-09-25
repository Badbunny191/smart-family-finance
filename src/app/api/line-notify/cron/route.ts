/**
 * LINE Daily Summary Cron Handler
 *
 * Cloudflare Cron Trigger: Runs every minute (`* * * * *`)
 * The handler:
 *   1. Validates environment
 *   2. Gets dashboard metrics (with items for Flex Message)
 *   3. Gets enabled LINE recipients (with last_sent_at for dedup)
 *   4. Filters recipients whose sendTime matches current Thai time exactly
 *   5. Skips recipients that already received a notification today (Asia/Bangkok)
 *   6. Sends FLEX MESSAGE to matching recipients
 *   7. Updates last_sent_at on success
 *
 * URL: GET /api/line-notify/cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/cloudflare';
import {
  runLineCron,
  type CronResult,
} from '@/lib/line-cron-service';

export const runtime = 'nodejs';

const EMPTY_METRICS = {
  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,
  monthlyNet: 0,
  pendingCount: 0,
  pendingTotal: 0,
  overdueCount: 0,
  overdueTotal: 0,
};

const EMPTY_SUMMARY = {
  totalRecipients: 0,
  totalSent: 0,
  totalFailed: 0,
  totalSkipped: 0,
};

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse<CronResult>> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // ============================================================
    // 1. Validate Environment
    // ============================================================
    const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!LINE_ACCESS_TOKEN) {
      console.error('[LINE Cron] LINE_CHANNEL_ACCESS_TOKEN not configured');
      return NextResponse.json(
        {
          success: false,
          timestamp,
          sentAt: 'N/A',
          metrics: EMPTY_METRICS,
          recipients: [],
          summary: EMPTY_SUMMARY,
          skipped: { reason: 'LINE_CHANNEL_ACCESS_TOKEN not configured' },
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 2. Get Cloudflare Context & Database
    // ============================================================
    const d1 = await getD1();
    const db = d1;

    if (!db) {
      console.error('[LINE Cron] Database not available');
      return NextResponse.json(
        {
          success: false,
          timestamp,
          sentAt: 'N/A',
          metrics: EMPTY_METRICS,
          recipients: [],
          summary: EMPTY_SUMMARY,
          skipped: { reason: 'Database not available' },
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 3. Run LINE Cron (Shared Service)
    // ============================================================
    console.log('[LINE Cron] Running LINE cron job...');
    const result = await runLineCron(db, LINE_ACCESS_TOKEN);

    const duration = Date.now() - startTime;
    console.log(
      `[LINE Cron] Completed in ${duration}ms: ${result.summary.totalSent} sent, ${result.summary.totalFailed} failed, ${result.summary.totalSkipped} skipped (already sent today)`
    );

    // ============================================================
    // 4. Return Response
    // ============================================================
    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[LINE Cron] Error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        timestamp,
        sentAt: 'N/A',
        metrics: EMPTY_METRICS,
        recipients: [],
        summary: EMPTY_SUMMARY,
        skipped: { reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      },
      { status: 500 }
    );
  }
}
