/**
 * LINE Notification Settings - Test Send
 *
 * POST /api/settings/line/test
 *
 * Forces a daily-summary send to all enabled recipients immediately
 * (bypasses sendTime check). Each recipient gets their own settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics } from '@/lib/dashboard-summary';
import { sendDailySummaryToUsers, formatDailySummaryMessage } from '@/lib/line-notify';
import { DEFAULT_DAILY_SUMMARY_SETTINGS, getBangkokDateString } from '@/lib/notification-settings';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  try {
    // Auth required — any logged-in user can test
    await getRequestContext(_request);
    const db = getDb(await getD1());

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
        displayName: lineAccounts.displayName,
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

    // 2) Get per-user settings from notification_settings
    const nsRows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.notificationType, 'daily_summary'));

    const nsByUserId = new Map<string, { settings: Record<string, unknown>; enabled: boolean }>();
    for (const row of nsRows) {
      nsByUserId.set(row.userId, {
        settings: JSON.parse(row.settings),
        enabled: row.enabled,
      });
    }

    // 3) Build recipients array with per-user settings
    const recipients = recipientsRaw.map((r) => {
      const ns = nsByUserId.get(r.userId);
      const defaultSettings = { ...DEFAULT_DAILY_SUMMARY_SETTINGS };
      const userSettings = ns
        ? { ...defaultSettings, ...ns.settings }
        : defaultSettings;
      return {
        lineUserId: r.lineUserId,
        displayName: r.displayName ?? 'Unknown',
        userId: r.userId,
        settings: userSettings,
      };
    });

    // 4) Fetch metrics
    const metrics = await getLineNotificationMetrics(db);
    const dateString = getBangkokDateString();

    // 5) Send to all recipients with their own settings
    const results = [];
    let totalSent = 0;
    let totalFailed = 0;

    for (const recipient of recipients) {
      const message = formatDailySummaryMessage(metrics, recipient.settings, dateString);
      const { sendDailySummaryToUser } = await import('@/lib/line-notify');
      const result = await sendDailySummaryToUser(recipient.lineUserId, message, LINE_ACCESS_TOKEN);
      results.push({ ...result, displayName: recipient.displayName, userId: recipient.userId });
      if (result.success) totalSent++;
      else totalFailed++;
    }

    return NextResponse.json({
      success: totalFailed === 0,
      sentAt: dateString,
      recipients: results.map((r) => ({
        userId: r.userId,
        displayName: r.displayName,
        sent: r.success,
        error: r.error,
      })),
      summary: { totalSent, totalFailed },
    });
  } catch (error) {
    console.error('[Test LINE] error:', error);
    return handleApiError(error);
  }
}
