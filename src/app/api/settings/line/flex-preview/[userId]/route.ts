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
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineNotificationMetrics, type LineNotificationItem } from '@/lib/dashboard-summary';
import { 
  buildDailySummaryFlexMessage, 
  SAMPLE_METRICS,
  type LineNotificationMetrics,
  type DailySummarySettings 
} from '@/lib/line-flex-message';
import { DEFAULT_DAILY_SUMMARY_SETTINGS, getBangkokDateString } from '@/lib/notification-settings';

export const runtime = 'nodejs';

// Extend metrics type to include items (from dashboard-summary)
interface FullLineNotificationMetrics extends LineNotificationMetrics {
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

    // 3) Get metrics (with pending/overdue items)
    const metrics = await getLineNotificationMetrics(db) as FullLineNotificationMetrics;
    
    // Convert to flex message metrics format
    const flexMetrics: LineNotificationMetrics = {
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
    };

    // 4) Build Flex Message
    let flexMessage;
    try {
      flexMessage = buildDailySummaryFlexMessage(flexMetrics, settings);
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
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // Return sample Flex Message for testing
    const flexMessage = buildDailySummaryFlexMessage(SAMPLE_METRICS, {
      sendTime: '08:00',
      showBalance: true,
      showIncome: true,
      showExpense: true,
      showPending: true,
      showOverdue: true,
      showPendingDetails: true,
      showOverdueDetails: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Sample Flex Message for testing',
      userId,
      dateString: getBangkokDateString(),
      flexMessage,
      previewType: 'sample',
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
