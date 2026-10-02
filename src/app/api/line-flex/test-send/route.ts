/**
 * LINE Test Send - No Auth Required
 * 
 * POST /api/line-flex/test-send
 * 
 * Test endpoint to send Flex Message to your own LINE account.
 * This endpoint bypasses authentication for testing purposes.
 * 
 * SINGLE SOURCE OF TRUTH:
 * - Uses getLineNotificationMetrics() from line-cron-service.ts
 * - Uses toFlexMetrics() from line-flex-sender.ts
 * - Uses buildFlexMessage() from line-flex-builder.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { sendFlexMessage, toFlexMetrics } from '@/lib/line-flex-sender';
import { buildFlexMessage } from '@/lib/line-flex-builder';
import { getLineNotificationMetrics } from '@/lib/line-cron-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { lineUserId?: string };
    
    const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!LINE_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'LINE_CHANNEL_ACCESS_TOKEN not configured'
      }, { status: 500 });
    }

    // Get D1 database
    const d1 = await getD1();
    const db = getDb(d1);

    // If no lineUserId provided, get your LINE account from database
    let targetLineUserId = body.lineUserId;
    
    if (!targetLineUserId) {
      // Get first enabled LINE account
      const lineAccountsResult = await db
        .select({ lineUserId: lineAccounts.lineUserId })
        .from(lineAccounts)
        .where(and(
          isNull(lineAccounts.deletedAt),
          eq(lineAccounts.notifyEnabled, true)
        ))
        .limit(1);
      
      if (lineAccountsResult.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'ไม่พบบัญชี LINE ที่เปิดใช้งาน'
        }, { status: 404 });
      }
      
      targetLineUserId = lineAccountsResult[0].lineUserId;
    }

    // ========== Get metrics using shared function ==========
    const metrics = await getLineNotificationMetrics(d1);
    
    // Convert to Flex metrics using shared function
    const flexMetrics = toFlexMetrics(metrics);

    // Build Flex Message using shared function
    const flexMessage = buildFlexMessage(flexMetrics, {
      sendTime: '08:00',
      showBalance: true,
      showMonthly: true,
      showToday: true,
      showOverdueReceive: true,
      showOverduePay: true,
      showPendingReceive: true,
      showPendingPay: true,
    });

    // Send Flex Message
    const result = await sendFlexMessage(targetLineUserId, flexMessage, LINE_ACCESS_TOKEN);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'ส่ง Flex Message สำเร็จ!',
        lineUserId: targetLineUserId,
        source: 'database',
        metrics: {
          totalBalance: metrics.totalBalance,
          monthlyIncome: metrics.monthlyIncome,
          monthlyExpense: metrics.monthlyExpense,
          today: metrics.today,
          pendingItems: metrics.pendingItems,
          overdueItems: metrics.overdueItems,
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        lineUserId: targetLineUserId
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Test Send] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support GET for easy testing in browser
export async function GET(request: NextRequest) {
  return POST(request);
}
