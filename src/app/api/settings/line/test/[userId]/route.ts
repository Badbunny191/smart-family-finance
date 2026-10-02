/**
 * LINE Notification Settings - Test Send Flex Message to Specific Recipient
 *
 * POST /api/settings/line/test/:userId
 *
 * Sends a FLEX MESSAGE to test on real LINE app.
 * Does NOT trigger cron logic (sendTime check bypassed).
 *
 * SINGLE BUILDER: uses `buildFlexMessage` from `line-flex-builder.ts`
 * — the SAME builder used by Cron, Preview, and Production.
 * No template duplication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics } from '@/lib/line-cron-service';
import { buildFlexMessage, LineFlexMetrics, LineFlexSettings } from '@/lib/line-flex-builder';
import { sendFlexMessage } from '@/lib/line-flex-sender';
import { DEFAULT_DAILY_SUMMARY_SETTINGS, getBangkokDateString, type DailySummarySettings } from '@/lib/notification-settings';

export const runtime = 'nodejs';

/**
 * Map DB settings (11 fields) → LineFlexSettings (7 fields used by builder)
 */
function toFlexSettings(s: DailySummarySettings): LineFlexSettings {
  const legacyShow = (s as any).showOverdue ?? true;
  const legacyPending = (s as any).showPending ?? true;

  return {
    sendTime: s.sendTime,
    showBalance: s.showBalance ?? true,
    showMonthly: s.showIncome ?? true,
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
    const d1 = await getD1();
    const db = getDb(d1);

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

    // 3) Get metrics from line-cron-service (SSOT)
    const metrics = await getLineNotificationMetrics(d1);

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
    const dateString = getBangkokDateString();

    // 5) Build Flex Message — SAME builder as production
    const flexMessage = buildFlexMessage(flexMetrics, toFlexSettings(settings));

    // 4.5) Validate Flex Message Schema
    const validation = validateFlexMessage(flexMessage);

    // 5) Send Flex Message to LINE
    const result = await sendFlexMessage(recipient.lineUserId, flexMessage, LINE_ACCESS_TOKEN);

    return NextResponse.json({
      success: result.success,
      recipient: {
        userId,
        displayName: recipient.displayName ?? 'Unknown',
        lineUserId: recipient.lineUserId,
      },
      settings,
      dateString,
      messageType: 'flex',
      result,
    });
  } catch (error) {
    console.error('[Test Flex per-recipient] error:', error);
    return handleApiError(error);
  }
}

// ============================================================
// FLEX SCHEMA VALIDATOR
// ============================================================

const UNSUPPORTED_PROPS = {
  box: ['paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom'],
  bubble: ['paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom', 'paddingAll'],
  header: ['paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom', 'paddingAll'],
  footer: ['paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom', 'paddingAll'],
  text: [],
  separator: [],
};

function validateFlexMessage(flex: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function checkUnsupported(obj: any, path: string, container: string): void {
    if (!obj || typeof obj !== 'object') return;

    const unsupported = UNSUPPORTED_PROPS[container as keyof typeof UNSUPPORTED_PROPS] || [];
    for (const prop of unsupported) {
      if (prop in obj) {
        errors.push(`${path}.${prop} - NOT SUPPORTED in ${container}`);
      }
    }
  }

  function walkContainer(obj: any, container: string, path: string): void {
    if (!obj || typeof obj !== 'object') return;
    checkUnsupported(obj, path, container);

    if (Array.isArray(obj.contents)) {
      obj.contents.forEach((c: any, i: number) => {
        const childPath = `${path}/contents[${i}]`;
        if (c?.type === 'box') {
          walkContainer(c, 'box', childPath);
        } else if (c?.type === 'text') {
          checkUnsupported(c, 'text', childPath);
        } else if (c?.type === 'separator') {
          checkUnsupported(c, 'separator', childPath);
        }
      });
    }
  }

  // Walk carousel
  if (flex?.type === 'carousel' && Array.isArray(flex.contents)) {
    flex.contents.forEach((bubble: any, i: number) => {
      const bubblePath = `/contents[${i}]`;
      checkUnsupported(bubble, bubblePath, 'bubble');

      if (bubble?.header) walkContainer(bubble.header, 'header', `${bubblePath}/header`);
      if (bubble?.body) walkContainer(bubble.body, 'body', `${bubblePath}/body`);
      if (bubble?.footer) walkContainer(bubble.footer, 'footer', `${bubblePath}/footer`);
    });
  }

  return { valid: errors.length === 0, errors };
}
