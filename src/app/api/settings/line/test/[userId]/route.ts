/**
 * LINE Notification Settings - Test Send Flex Message to Specific Recipient
 *
 * POST /api/settings/line/test/:userId
 *
 * Sends a FLEX MESSAGE to test on real LINE app.
 * Does NOT trigger cron logic (sendTime check bypassed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics, type LineNotificationItem } from '@/lib/dashboard-summary';
import { buildDailySummaryFlexMessage, SAMPLE_METRICS } from '@/lib/line-flex-message';
import { sendFlexMessage } from '@/lib/line-flex-sender';
import { DEFAULT_DAILY_SUMMARY_SETTINGS, getBangkokDateString } from '@/lib/notification-settings';

export const runtime = 'nodejs';

// Interface matching line-flex-message.ts
interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
}

// Full metrics with items
interface LineNotificationMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  pendingItems: LineNotificationItem[];
  overdueItems: LineNotificationItem[];
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

    // 3) Get metrics with items
    const metrics = await getLineNotificationMetrics(db) as LineNotificationMetrics;
    const dateString = getBangkokDateString();

    // 4) Build Flex Message
    const flexMessage = buildDailySummaryFlexMessage(
      {
        totalBalance: metrics.totalBalance,
        monthlyIncome: metrics.monthlyIncome,
        monthlyExpense: metrics.monthlyExpense,
        monthlyNet: metrics.monthlyNet,
        pendingCount: metrics.pendingCount,
        pendingTotal: metrics.pendingTotal,
        overdueCount: metrics.overdueCount,
        overdueTotal: metrics.overdueTotal,
        pendingItems: metrics.pendingItems || [],
        overdueItems: metrics.overdueItems || [],
      },
      {
        sendTime: settings.sendTime,
        showBalance: settings.showBalance,
        showIncome: settings.showIncome,
        showExpense: settings.showExpense,
        showPending: settings.showPending,
        showOverdue: settings.showOverdue,
        showPendingDetails: settings.showPendingDetails,
        showOverdueDetails: settings.showOverdueDetails,
      }
    );

    // DEBUG: Log flex message
    console.log('\n========== FLEX MESSAGE JSON ==========');
    console.log(JSON.stringify(flexMessage, null, 2));
    console.log('========================================\n');

    // 4.5) Validate Flex Message Schema
    const validation = validateFlexMessage(flexMessage);
    console.log('\n========== FLEX SCHEMA VALIDATION ==========');
    if (validation.valid) {
      console.log('✅ VALID - All properties conform to LINE Flex Schema');
    } else {
      console.log('❌ INVALID - Found unsupported properties:');
      validation.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log('==========================================\n');

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
