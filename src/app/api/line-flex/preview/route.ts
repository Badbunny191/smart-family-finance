/**
 * LINE Flex Preview API
 * GET /api/line-flex/preview
 * 
 * Returns LINE Flex Message JSON from REAL database data.
 * NO SAMPLE DATA - Real data only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getD1 } from '@/lib/cloudflare';
import { accounts, transactions } from '@/db/schema';
import { eq, and, isNull, gte, lt, inArray, or, sql } from 'drizzle-orm';
import {
  buildFlexMessage,
  LineFlexMetrics,
} from '@/lib/line-flex-builder';

export const runtime = 'nodejs';

/**
 * Get current month range in Bangkok timezone
 */
function getCurrentMonthRange(): { monthStart: Date; nextMonthStart: Date } {
  const now = new Date();
  // Use UTC dates for database query
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

/**
 * Get today's date range for "today" transactions
 */
function getTodayRange(): { todayStart: Date; todayEnd: Date } {
  const now = new Date();
  // Bangkok timezone = UTC+7, so get today's date in Bangkok
  const bangkokDate = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  // Start of today in Bangkok = start of today in UTC-7 = some time yesterday in UTC
  const todayBangkok = new Date(bangkokDate);
  todayBangkok.setHours(0, 0, 0, 0);
  
  // Convert back to UTC
  const todayStart = new Date(todayBangkok.getTime() - (7 * 60 * 60 * 1000));
  const todayEnd = new Date(todayBangkok.getTime() + (24 * 60 * 60 * 1000) - 1 - (7 * 60 * 60 * 1000));
  
  return { todayStart, todayEnd };
}

/**
 * Fetch REAL metrics from database
 */
async function getRealMetrics(db: ReturnType<typeof getDb>): Promise<{
  metrics: LineFlexMetrics;
  debug: Record<string, any>;
}> {
  const debug: Record<string, any> = {};
  const { monthStart, nextMonthStart } = getCurrentMonthRange();
  const { todayStart, todayEnd } = getTodayRange();
  
  debug.monthStart = monthStart.toISOString();
  debug.monthEnd = nextMonthStart.toISOString();
  debug.todayStart = todayStart.toISOString();
  debug.todayEnd = todayEnd.toISOString();
  
  // 1. Total Balance (cash + bank accounts only)
  const balanceResult = await db
    .select({
      totalBalance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`.as('total_balance'),
    })
    .from(accounts)
    .where(
      and(
        inArray(accounts.accountType, ['cash', 'bank']),
        isNull(accounts.deletedAt)
      )
    );
  
  debug.balanceQuery = balanceResult;
  const totalBalance = Number(balanceResult[0]?.totalBalance) || 0;
  
  // 2. Monthly Income/Expense (completed transactions only)
  const incomeExpenseResult = await db
    .select({
      type: transactions.type,
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`.as('total'),
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
  
  debug.incomeExpenseQuery = incomeExpenseResult;
  
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const row of incomeExpenseResult) {
    if (row.type === 'income') {
      monthlyIncome = Number(row.total) || 0;
    } else if (row.type === 'expense') {
      monthlyExpense = Number(row.total) || 0;
    }
  }
  
  // 3. Today's Transactions (completed only)
  const todayResult = await db
    .select({
      type: transactions.type,
      count: sql<number>`COUNT(*)`.as('count'),
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`.as('total'),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, 'completed'),
        gte(transactions.date, todayStart),
        lt(transactions.date, todayEnd)
      )
    )
    .groupBy(transactions.type);
  
  debug.todayQuery = todayResult;
  
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
  
  // 4. Pending/Overdue Transactions
  // Overdue: due date + 1 day 18:00 < now (Bangkok)
  // Pending: due date + 1 day 18:00 >= now (Bangkok)
  
  // Overdue Receive (income + pending + overdue)
  const overdueReceiveResult = await db
    .select({
      title: transactions.title,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
      )
    )
    .orderBy(transactions.date)
    .limit(10);
  
  debug.overdueReceiveCount = overdueReceiveResult.length;
  
  // Overdue Pay (expense + pending + overdue)
  const overduePayResult = await db
    .select({
      title: transactions.title,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'expense'),
        eq(transactions.businessStatus, 'pending'),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
      )
    )
    .orderBy(transactions.date)
    .limit(10);
  
  debug.overduePayCount = overduePayResult.length;
  
  // Pending Receive (income + pending + not overdue)
  const pendingReceiveResult = await db
    .select({
      title: transactions.title,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
      )
    )
    .orderBy(transactions.date)
    .limit(10);
  
  debug.pendingReceiveCount = pendingReceiveResult.length;
  
  // Pending Pay (expense + pending + not overdue)
  const pendingPayResult = await db
    .select({
      title: transactions.title,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'expense'),
        eq(transactions.businessStatus, 'pending'),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
      )
    )
    .orderBy(transactions.date)
    .limit(10);
  
  debug.pendingPayCount = pendingPayResult.length;
  
  const metrics: LineFlexMetrics = {
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
    overdueReceive: overdueReceiveResult.map(r => ({
      title: r.title || 'ไม่ระบุ',
      amount: Number(r.amount) || 0,
    })),
    overduePay: overduePayResult.map(r => ({
      title: r.title || 'ไม่ระบุ',
      amount: Number(r.amount) || 0,
    })),
    pendingReceive: pendingReceiveResult.map(r => ({
      title: r.title || 'ไม่ระบุ',
      amount: Number(r.amount) || 0,
    })),
    pendingPay: pendingPayResult.map(r => ({
      title: r.title || 'ไม่ระบุ',
      amount: Number(r.amount) || 0,
    })),
  };
  
  return { metrics, debug };
}

export async function GET(request: NextRequest) {
  let d1 = null;
  let db = null;
  let useRealDatabase = false;
  
  // Try to get D1 from Cloudflare context
  try {
    d1 = await getD1();
    db = getDb(d1);
    useRealDatabase = true;
  } catch (d1Error) {
    const errorMsg = d1Error instanceof Error ? d1Error.message : 'Unknown error';
    console.log('[Flex Preview] D1 not available:', errorMsg);
    console.log('[Flex Preview] Falling back to mock data for testing');
  }
  
  // If D1 available, try to fetch real data
  if (useRealDatabase && db) {
    try {
      const { metrics, debug } = await getRealMetrics(db);
      const flexMessage = buildFlexMessage(metrics, parseSettingsFromUrl(request.nextUrl.searchParams));

      return NextResponse.json({
        source: 'database',
        debug,
        metrics,
        flexMessage,
      });
    } catch (error) {
      console.error('[Flex Preview] Database query error:', error);
      // Fall through to mock data
    }
  }
  
  // Build mock data for local testing (when D1 not available)
  // NOTE: This is MOCK data, NOT real data
  const mockMetrics: LineFlexMetrics = {
    totalBalance: 0,
    monthly: {
      income: 0,
      expense: 0,
    },
    today: {
      receivedCount: 0,
      receivedAmount: 0,
      paidCount: 0,
      paidAmount: 0,
    },
    overdueReceive: [],
    overduePay: [],
    pendingReceive: [],
    pendingPay: [],
  };

  const flexMessage = buildFlexMessage(mockMetrics, parseSettingsFromUrl(request.nextUrl.searchParams));

  return NextResponse.json({
    source: 'mock_no_d1',
    warning: 'D1 Database not available. Using empty mock data. Deploy to Cloudflare to use real data.',
    mockData: true,
    metrics: mockMetrics,
    flexMessage,
    instructions: {
      localDev: 'npm run dev:cron (requires D1 local binding)',
      cloudflareDev: 'npx wrangler dev --config wrangler.toml --local',
      production: 'npm run deploy',
    },
  });
}

/**
 * Parse settings from URL query params.
 * 
 * Supports checkbox toggles (true/false):
 *   ?showToday=false&showOverdueReceive=false&showOverduePay=true&showPendingReceive=false&showPendingPay=true
 * 
 * Unknown params are ignored. Missing params default to `true` (show section).
 */
function parseSettingsFromUrl(params: URLSearchParams) {
  const boolKeys = [
    'showBalance',
    'showMonthly',
    'showToday',
    'showOverdueReceive',
    'showOverduePay',
    'showPendingReceive',
    'showPendingPay',
  ] as const;

  const settings: Record<string, boolean> = {};
  for (const k of boolKeys) {
    const v = params.get(k);
    if (v === null) {
      settings[k] = true; // default: visible
    } else {
      settings[k] = v !== 'false' && v !== '0';
    }
  }

  // sendTime: optional in URL, default to "08:00"
  const sendTime = params.get('sendTime') ?? '08:00';

  return {
    sendTime,
    showBalance: settings.showBalance,
    showMonthly: settings.showMonthly,
    showToday: settings.showToday,
    showOverdueReceive: settings.showOverdueReceive,
    showOverduePay: settings.showOverduePay,
    showPendingReceive: settings.showPendingReceive,
    showPendingPay: settings.showPendingPay,
  };
}
