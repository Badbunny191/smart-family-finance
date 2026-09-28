/**
 * LINE Test Send - No Auth Required
 * 
 * POST /api/line-flex/test-send
 * 
 * Test endpoint to send Flex Message to your own LINE account.
 * This endpoint bypasses authentication for testing purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, transactions, accounts } from '@/db/schema';
import { eq, and, isNull, gte, lt, inArray, or, sql } from 'drizzle-orm';
import { sendFlexMessage } from '@/lib/line-flex-sender';
import { buildFlexMessage } from '@/lib/line-flex-builder';
import { DEFAULT_DAILY_SUMMARY_SETTINGS } from '@/lib/notification-settings';

export const runtime = 'nodejs';

/**
 * Get current month range in Bangkok timezone
 */
function getCurrentMonthRange(): { monthStart: Date; nextMonthStart: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

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

    // ========== Query REAL data from Database ==========
    const { monthStart, nextMonthStart } = getCurrentMonthRange();
    
    // 1. Total Balance
    const balanceResult = await db
      .select({
        totalBalance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
      })
      .from(accounts)
      .where(
        and(
          inArray(accounts.accountType, ['cash', 'bank']),
          isNull(accounts.deletedAt)
        )
      );
    const totalBalance = Number(balanceResult[0]?.totalBalance) || 0;
    
    // 2. Monthly Income/Expense
    const incomeExpenseResult = await db
      .select({
        type: transactions.type,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'completed'),
          gte(transactions.date, monthStart),
          lt(transactions.date, nextMonthStart),
          or(
            eq(transactions.type, 'income'),
            eq(transactions.type, 'expense')
          )
        )
      )
      .groupBy(transactions.type);
    
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const row of incomeExpenseResult) {
      if (row.type === 'income') {
        monthlyIncome = Number(row.total) || 0;
      } else if (row.type === 'expense') {
        monthlyExpense = Number(row.total) || 0;
      }
    }
    
    // 3. Today transactions (Bangkok timezone)
    const todayStart = new Date();
    todayStart.setUTCHours(17, 0, 0, 0); // Bangkok 00:00
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    todayEnd.setUTCMilliseconds(-1); // End of day
    
    const todayResult = await db
      .select({
        type: transactions.type,
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'completed'),
          gte(transactions.date, todayStart),
          lt(transactions.date, todayEnd),
          or(eq(transactions.type, 'income'), eq(transactions.type, 'expense'))
        )
      )
      .groupBy(transactions.type);
    
    let todayReceivedCount = 0;
    let todayReceivedAmount = 0;
    let todayPaidCount = 0;
    let todayPaidAmount = 0;
    
    for (const row of todayResult) {
      if (row.type === 'income') {
        todayReceivedCount = Number(row.count) || 0;
        todayReceivedAmount = Number(row.total) || 0;
      } else if (row.type === 'expense') {
        todayPaidCount = Number(row.count) || 0;
        todayPaidAmount = Number(row.total) || 0;
      }
    }
    
    // 3. Pending/Overdue Receive (income - เงินที่ต้องรับ)
    const pendingReceiveResult = await db
      .select({ title: transactions.title, amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'income'),
          eq(transactions.businessStatus, 'pending'),
          sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
        )
      )
      .orderBy(transactions.date)
      .limit(5);
    
    const overdueReceiveResult = await db
      .select({ title: transactions.title, amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'income'),
          eq(transactions.businessStatus, 'pending'),
          sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
        )
      )
      .orderBy(transactions.date)
      .limit(5);
    
    // 4. Pending/Overdue Pay (expense - ค่าใช้จ่ายที่ต้องจ่าย)
    const pendingPayResult = await db
      .select({ title: transactions.title, amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          eq(transactions.businessStatus, 'pending'),
          sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
        )
      )
      .orderBy(transactions.date)
      .limit(5);
    
    const overduePayResult = await db
      .select({ title: transactions.title, amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          eq(transactions.businessStatus, 'pending'),
          sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
        )
      )
      .orderBy(transactions.date)
      .limit(5);

    // Build metrics and Flex Message with ALL data (receive + pay)
    const flexMetrics = {
      totalBalance,
      monthly: {
        income: monthlyIncome,
        expense: monthlyExpense,
      },
      today: {
        receivedCount: todayReceivedCount,
        receivedAmount: todayReceivedAmount,
        paidCount: todayPaidCount,
        paidAmount: todayPaidAmount,
      },
      overdueReceive: overdueReceiveResult.map(r => ({ title: r.title || 'ไม่ระบุ', amount: Number(r.amount) })),
      overduePay: overduePayResult.map(r => ({ title: r.title || 'ไม่ระบุ', amount: Number(r.amount) })),
      pendingReceive: pendingReceiveResult.map(r => ({ title: r.title || 'ไม่ระบุ', amount: Number(r.amount) })),
      pendingPay: pendingPayResult.map(r => ({ title: r.title || 'ไม่ระบุ', amount: Number(r.amount) })),
    };

    console.log('\n========== LINE FLEX TEST SEND ==========');
    console.log('📊 Metrics from Database (REAL DATA):');
    console.log('   totalBalance:', totalBalance);
    console.log('   monthlyIncome:', monthlyIncome);
    console.log('   monthlyExpense:', monthlyExpense);
    console.log('   monthlyNet:', monthlyIncome - monthlyExpense);
    console.log('   todayReceivedCount:', todayReceivedCount, 'amount:', todayReceivedAmount);
    console.log('   todayPaidCount:', todayPaidCount, 'amount:', todayPaidAmount);
    console.log('   pendingReceive:', pendingReceiveResult.length, 'รายการ');
    console.log('   overdueReceive:', overdueReceiveResult.length, 'รายการ');
    console.log('   pendingPay:', pendingPayResult.length, 'รายการ');
    console.log('   overduePay:', overduePayResult.length, 'รายการ');
    console.log('==========================================\n');

    // Build Flex Message
    const flexMessage = buildFlexMessage(flexMetrics, {
      sendTime: DEFAULT_DAILY_SUMMARY_SETTINGS.sendTime,
      showBalance: true,
      showMonthly: true,
      showToday: true,
      showOverdueReceive: true,
      showOverduePay: true,
      showPendingReceive: true,
      showPendingPay: true,
    });

    console.log('\n========== LINE FLEX JSON (FINAL PAYLOAD) ==========');
    console.log(JSON.stringify(flexMessage, null, 2));
    console.log('====================================================\n');

    // Send Flex Message
    const result = await sendFlexMessage(targetLineUserId, flexMessage, LINE_ACCESS_TOKEN);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'ส่ง Flex Message สำเร็จ!',
        lineUserId: targetLineUserId,
        source: 'database',
        metrics: {
          totalBalance,
          monthlyIncome,
          monthlyExpense,
          monthlyNet: monthlyIncome - monthlyExpense,
          pendingReceive: pendingReceiveResult,
          overdueReceive: overdueReceiveResult,
          pendingPay: pendingPayResult,
          overduePay: overduePayResult,
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
