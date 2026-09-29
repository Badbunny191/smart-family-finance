/**
 * LINE Flex Message Preview API
 *
 * POST /api/settings/line/flex-preview/[userId]
 *
 * Returns a Flex Message JSON that would be sent to a specific user,
 * based on their current settings. Does NOT send anything.
 *
 * This allows users to preview how their LINE notification will look
 * before saving settings.
 *
 * SINGLE BUILDER: uses `buildFlexMessage` from `line-flex-builder.ts`
 * — the SAME builder used by Cron, Test-Send, and Production.
 * No template duplication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics } from '@/lib/line-cron-service';
import {
  buildFlexMessage,
  LineFlexMetrics,
  LineFlexSettings,
} from '@/lib/line-flex-builder';
import { DEFAULT_DAILY_SUMMARY_SETTINGS, getBangkokDateString, type DailySummarySettings } from '@/lib/notification-settings';

export const runtime = 'nodejs';

/**
 * Map settings from DB (11 fields) → LineFlexSettings (7 fields used by builder).
 * The 4 extra fields (Details, Net, etc.) are used for message text in the future;
 * current builder only consults 7 boolean show* flags.
 */
function toFlexSettings(s: DailySummarySettings): LineFlexSettings {
  // Backward compat: legacy showOverdue/showPending as fallback
  const legacyShow = (s as any).showOverdue ?? true;
  const legacyPending = (s as any).showPending ?? true;

  return {
    sendTime: s.sendTime,
    showBalance: s.showBalance ?? true,
    showMonthly: s.showIncome ?? true,    // builder uses showMonthly; map to showIncome
    showToday: s.showToday ?? true,
    showOverdueReceive: s.showOverdueReceive ?? legacyShow,
    showOverduePay: s.showOverduePay ?? legacyShow,
    showPendingReceive: s.showPendingReceive ?? legacyPending,
    showPendingPay: s.showPendingPay ?? legacyPending,
  };
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

    // 3) Get metrics from line-cron-service (SSOT)
    console.log('[FlexPreview:POST] Calling getLineNotificationMetrics for userId:', userId);
    const metrics = await getLineNotificationMetrics(db);
    console.log('[FlexPreview:POST] metrics.today:', JSON.stringify(metrics.today));

    // 4) Build flexMetrics with ALL 4 arrays from SSOT
    const flexMetrics: LineFlexMetrics = {
      totalBalance: metrics.totalBalance,
      monthly: {
        income: metrics.monthlyIncome,
        expense: metrics.monthlyExpense,
      },
      today: metrics.today,
      overdueReceive: (metrics.overdueItems ?? []).map((it) => ({ title: it.title, amount: Number(it.amount) })),
      pendingReceive: (metrics.pendingItems ?? []).map((it) => ({ title: it.title, amount: Number(it.amount) })),
      overduePay: (metrics.overduePayItems ?? []).map((it) => ({ title: it.title, amount: Number(it.amount) })),
      pendingPay: (metrics.pendingPayItems ?? []).map((it) => ({ title: it.title, amount: Number(it.amount) })),
    };

    console.log('[FlexPreview] metrics.today:', metrics.today);

    // 🚨 AUDIT: Dump full flexMetrics before buildFlexMessage
    console.log('[FlexPreview] flexMetrics.today:', JSON.stringify({
      receivedCount: metrics.today.receivedCount,
      receivedAmount: metrics.today.receivedAmount,
      paidCount: metrics.today.paidCount,
      paidAmount: metrics.today.paidAmount,
    }));

    // 5) Build Flex Message — SAME builder as production
    let flexMessage;
    try {
      const flexSettings = toFlexSettings(settings);
      console.log('[FlexPreview] flexSettings.showToday:', flexSettings.showToday);
      flexMessage = buildFlexMessage(flexMetrics, flexSettings);
    } catch (err) {
      console.error('[FlexPreview] build error:', err);
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถสร้าง Flex Message ได้',
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
      dateString: getBangkokDateString(),
      flexMessage,
      previewType: 'flex',
      builder: 'line-flex-builder.ts#buildFlexMessage', // confirms single source of truth
    });
  } catch (error) {
    console.error('[FlexPreview] error:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดตัวอย่าง';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}

/**
 * GET /api/settings/line/flex-preview/[userId]
 *
 * Returns a sample Flex Message for testing/development.
 * Does not require authentication.
 *
 * Uses the SAME builder as production — no separate template.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Sample metrics (empty)
    const sampleMetrics: LineFlexMetrics = {
      totalBalance: 0,
      monthly: { income: 0, expense: 0 },
      today: { receivedCount: 0, receivedAmount: 0, paidCount: 0, paidAmount: 0 },
      overdueReceive: [],
      overduePay: [],
      pendingReceive: [],
      pendingPay: [],
    };

    // Sample settings — same defaults as production
    const sampleSettings: LineFlexSettings = {
      sendTime: '08:00',
      showBalance: true,
      showMonthly: true,
      showToday: true,
      showOverdueReceive: true,
      showOverduePay: true,
      showPendingReceive: true,
      showPendingPay: true,
    };

    // SAME builder as production
    const flexMessage = buildFlexMessage(sampleMetrics, sampleSettings);

    return NextResponse.json({
      success: true,
      message: 'Sample Flex Message for testing',
      userId,
      dateString: getBangkokDateString(),
      flexMessage,
      previewType: 'sample',
      builder: 'line-flex-builder.ts#buildFlexMessage',
    });
  } catch (error) {
    console.error('[FlexPreview] GET error:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดตัวอย่าง';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
