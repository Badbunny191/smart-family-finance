/**
 * LINE Notification Settings - Test Send to Specific Recipient
 *
 * POST /api/settings/line/test/:userId
 *
 * Sends a test LINE message to a specific recipient using their settings.
 * Does NOT trigger cron logic (sendTime check bypassed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics } from '@/lib/dashboard-summary';
import { sendDailySummaryToUser, formatDailySummaryMessage } from '@/lib/line-notify';
import { DEFAULT_DAILY_SUMMARY_SETTINGS, getBangkokDateString } from '@/lib/notification-settings';

export const runtime = 'nodejs';

interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Auth required
    await getRequestContext(_request);
    const { userId } = await params;
    const db = getDb(await getD1());

    const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!LINE_ACCESS_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' },
        { status: 500 }
      );
    }

    // 1) Get LINE account for this user
    const lineAccount = await db
      .select()
      .from(lineAccounts)
      .where(
        and(
          eq(lineAccounts.userId, userId),
          isNull(lineAccounts.deletedAt)
        )
      )
      .limit(1);

    if (lineAccount.length === 0) {
      return NextResponse.json(
        { success: false, error: `No LINE account found for user ${userId}` },
        { status: 404 }
      );
    }

    const recipient = lineAccount[0];

    // 2) Get notification settings for this user
    const nsRow = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    let settings: DailySummarySettings = { ...DEFAULT_DAILY_SUMMARY_SETTINGS };
    if (nsRow.length > 0) {
      const parsed = JSON.parse(nsRow[0].settings) as Partial<DailySummarySettings>;
      settings = { ...DEFAULT_DAILY_SUMMARY_SETTINGS, ...parsed };
    }

    // 3) Get metrics
    const metrics = await getLineNotificationMetrics(db);
    const dateString = getBangkokDateString();

    // 4) Format and send
    const message = formatDailySummaryMessage(metrics, settings, dateString);
    const result = await sendDailySummaryToUser(recipient.lineUserId, message, LINE_ACCESS_TOKEN);

    return NextResponse.json({
      success: result.success,
      recipient: {
        userId,
        displayName: recipient.displayName ?? 'Unknown',
        lineUserId: recipient.lineUserId,
      },
      settings,
      message,
      result,
    });
  } catch (error) {
    console.error('[Test per-recipient] error:', error);
    return handleApiError(error);
  }
}
