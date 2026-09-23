/**
 * LINE Daily Summary Cron Handler
 * 
 * Cloudflare Cron Trigger: Runs every minute
 * The handler checks each recipient's sendTime (Asia/Bangkok)
 * and only sends when the configured HH:mm matches current Thai time exactly.
 * 
 * This endpoint:
 * 1. Validates environment
 * 2. Gets dashboard metrics
 * 3. Gets enabled LINE recipients
 * 4. Filters recipients whose sendTime matches current Thai time
 * 5. Sends daily summary to matching recipients
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
          metrics: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, pendingCount: 0, pendingTotal: 0, overdueCount: 0, overdueTotal: 0 },
          recipients: [],
          summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
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
          metrics: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, pendingCount: 0, pendingTotal: 0, overdueCount: 0, overdueTotal: 0 },
          recipients: [],
          summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
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
    console.log(`[LINE Cron] Completed in ${duration}ms: ${result.summary.totalSent} sent, ${result.summary.totalFailed} failed`);

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
        metrics: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, pendingCount: 0, pendingTotal: 0, overdueCount: 0, overdueTotal: 0 },
        recipients: [],
        summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
        skipped: { reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      },
      { status: 500 }
    );
  }
}
