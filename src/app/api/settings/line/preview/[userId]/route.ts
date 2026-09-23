/**
 * LINE Notification Settings - Preview Message
 *
 * POST /api/settings/line/preview/:userId
 *
 * Returns the LINE message that would be sent to a specific user,
 * based on their current (or provided) settings. Does NOT send anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics } from '@/lib/dashboard-summary';
import { formatDailySummaryMessage } from '@/lib/line-notify';
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

    // 1) Get LINE account info
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

    // 4) Format message
    let message = '';
    try {
      message = formatDailySummaryMessage(metrics, settings, dateString);
    } catch (err) {
      console.error('[Preview] format error:', err);
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถสร้างข้อความตัวอย่างได้',
        details: err instanceof Error ? err.message : String(err),
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      recipient: {
        userId,
        displayName: lineAccount[0].displayName ?? 'Unknown',
        lineUserId: lineAccount[0].lineUserId,
      },
      settings,
      message,
    });
  } catch (error) {
    console.error('[Preview] error:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดตัวอย่าง';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
