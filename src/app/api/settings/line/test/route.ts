/**
 * LINE Notification Settings - Test Send
 *
 * POST /api/settings/line/test
 *
 * Forces a daily-summary send to all enabled recipients immediately
 * (bypasses sendTime check). Used by the "ทดสอบส่ง LINE ตอนนี้" button.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics } from '@/lib/dashboard-summary';
import { sendDailySummaryToUsers } from '@/lib/line-notify';
import { getBangkokDateString } from '@/lib/notification-settings';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Auth required — any logged-in user can test
    const { db } = await getRequestContext(request);

    const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!LINE_ACCESS_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' },
        { status: 500 }
      );
    }

    // 1) Get all enabled line_accounts (recipients with notifyEnabled=true)
    const recipientsRaw = await db
      .select({
        id: lineAccounts.id,
        userId: lineAccounts.userId,
        lineUserId: lineAccounts.lineUserId,
      })
      .from(lineAccounts)
      .where(
        and(isNull(lineAccounts.deletedAt), eq(lineAccounts.notifyEnabled, true))
      );

    if (recipientsRaw.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ไม่มีผู้รับที่เปิดใช้งาน',
        sentAt: getBangkokDateString(),
        recipients: [],
        summary: { totalSent: 0, totalFailed: 0 },
      });
    }

    // 2) Try to load daily_summary settings from any user (it is per-user)
    // For test send, we use settings from the first available user
    const settingsRows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.notificationType, 'daily_summary'))
      .limit(1);

    type DSSettings = {
      sendTime: string;
      showBalance: boolean;
      showIncome: boolean;
      showExpense: boolean;
      showPending: boolean;
      showOverdue: boolean;
    };

    let settings: DSSettings = {
      sendTime: '08:00',
      showBalance: true,
      showIncome: true,
      showExpense: true,
      showPending: true,
      showOverdue: true,
    };

    if (settingsRows.length > 0) {
      try {
        const parsed = JSON.parse(settingsRows[0].settings);
        settings = { ...settings, ...parsed };
      } catch {
        // Use defaults
      }
    }

    // 3) Build recipients array
    const recipients = recipientsRaw.map((r) => ({
      lineUserId: r.lineUserId,
      settings,
    }));

    // 4) Fetch metrics
    const metrics = await getLineNotificationMetrics(db);

    // 5) Send
    const dateString = getBangkokDateString();
    const { results, totalSent, totalFailed } = await sendDailySummaryToUsers(
      recipients,
      metrics,
      dateString,
      LINE_ACCESS_TOKEN
    );

    const testSentAt = new Date().toISOString();

    return NextResponse.json({
      success: totalFailed === 0,
      testSentAt,
      sentAt: dateString,
      recipients: results.map((r) => ({
        lineUserId: r.lineUserId,
        sent: r.success,
        error: r.error,
      })),
      summary: {
        totalSent,
        totalFailed,
      },
    });
  } catch (error) {
    console.error('[Test LINE] error:', error);
    return handleApiError(error);
  }
}
