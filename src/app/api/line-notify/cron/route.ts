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
import { getDb } from '@/db/client';
import { getLineNotificationMetrics } from '@/lib/dashboard-summary';
import {
  getEnabledRecipients,
  shouldSendNow,
  getBangkokDateString,
  getCurrentBangkokTimeString,
} from '@/lib/notification-settings';
import { sendDailySummaryToUsers } from '@/lib/line-notify';

export const runtime = 'nodejs';

// ============================================================
// TYPES
// ============================================================

interface CronResponse {
  success: boolean;
  timestamp: string;
  sentAt: string;
  metrics: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    monthlyNet: number;
    pendingCount: number;
    pendingTotal: number;
    overdueCount: number;
    overdueTotal: number;
  };
  recipients: {
    lineUserId: string;
    sent: boolean;
    error?: string;
  }[];
  summary: {
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
  };
  skipped: {
    reason: string;
  } | null;
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse<CronResponse>> {
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
          sentAt: getBangkokDateString(),
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
    const db = getDb(d1);

    if (!db) {
      console.error('[LINE Cron] Database not available');
      return NextResponse.json(
        {
          success: false,
          timestamp,
          sentAt: getBangkokDateString(),
          metrics: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, pendingCount: 0, pendingTotal: 0, overdueCount: 0, overdueTotal: 0 },
          recipients: [],
          summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
          skipped: { reason: 'Database not available' },
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 3. Get Dashboard Metrics
    // ============================================================
    console.log('[LINE Cron] Fetching dashboard metrics...');
    const metrics = await getLineNotificationMetrics(db);
    console.log(`[LINE Cron] Metrics fetched: balance=${metrics.totalBalance}, income=${metrics.monthlyIncome}`);

    // ============================================================
    // 4. Get Enabled Recipients
    // ============================================================
    console.log('[LINE Cron] Fetching enabled recipients...');
    const recipients = await getEnabledRecipients(db);

    if (recipients.length === 0) {
      console.log('[LINE Cron] No enabled recipients, skipping');
      return NextResponse.json({
        success: true,
        timestamp,
        sentAt: getBangkokDateString(),
        metrics,
        recipients: [],
        summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
        skipped: { reason: 'No enabled LINE recipients' },
      });
    }

    console.log(`[LINE Cron] Found ${recipients.length} recipients`);

    // ============================================================
    // 5. Filter recipients by their configured sendTime (Asia/Bangkok)
    // ============================================================
    const currentThaiTime = getCurrentBangkokTimeString();
    console.log(`[LINE Cron] Current Thai Time: ${currentThaiTime}`);

    // Group recipients by their configured sendTime
    const recipientsToSend = recipients.filter((r) => {
      const configuredTime = r.settings?.sendTime;
      if (!configuredTime) {
        console.log(`[LINE Cron] Recipient ${r.lineUserId} has no sendTime, skipping`);
        return false;
      }
      const match = shouldSendNow(configuredTime);
      console.log(`[LINE Cron] Recipient ${r.lineUserId} → Configured Time: ${configuredTime} → ${match ? 'WILL SEND' : 'skip'}`);
      return match;
    });

    if (recipientsToSend.length === 0) {
      console.log(`[LINE Cron] No recipients match current Thai time ${currentThaiTime}, skipping`);
      return NextResponse.json({
        success: true,
        timestamp,
        sentAt: getBangkokDateString(),
        metrics,
        recipients: [],
        summary: { totalRecipients: recipients.length, totalSent: 0, totalFailed: 0 },
        skipped: { reason: `No recipients match Thai time ${currentThaiTime}` },
      });
    }

    console.log(`[LINE Cron] ${recipientsToSend.length}/${recipients.length} recipients match current Thai time`);

    // ============================================================
    // 6. Send to Matching Recipients
    // ============================================================
    console.log(`[LINE Cron] Sending daily summary to ${recipientsToSend.length} recipients at Thai time ${currentThaiTime}...`);
    const dateString = getBangkokDateString();
    
    const { results, totalSent, totalFailed } = await sendDailySummaryToUsers(
      recipientsToSend,
      metrics,
      dateString,
      LINE_ACCESS_TOKEN
    );

    const duration = Date.now() - startTime;
    console.log(`[LINE Cron] Completed in ${duration}ms: ${totalSent} sent, ${totalFailed} failed`);

    // ============================================================
    // 7. Return Response
    // ============================================================
    return NextResponse.json({
      success: totalFailed === 0,
      timestamp,
      sentAt: dateString,
      metrics,
      recipients: results.map(r => ({
    lineUserId: r.lineUserId,
    sent: r.success,
    error: r.error,
  })),
      summary: {
        totalRecipients: recipients.length,
        totalSent,
        totalFailed,
      },
      skipped: null,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[LINE Cron] Error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        timestamp,
        sentAt: getBangkokDateString(),
        metrics: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, pendingCount: 0, pendingTotal: 0, overdueCount: 0, overdueTotal: 0 },
        recipients: [],
        summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
        skipped: { reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      },
      { status: 500 }
    );
  }
}
