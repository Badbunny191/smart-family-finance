/**
 * Dashboard Summary Service
 * 
 * Single source of truth for dashboard metrics.
 * Used by:
 * - Dashboard page (src/app/dashboard/page.tsx)
 * - LINE Daily Summary cron (src/app/api/line-notify/cron/route.ts)
 * 
 * This module contains all the database queries for:
 * - Total Balance
 * - Monthly Income/Expense
 * - Pending/Overdue summaries
 */

import { and, eq, gte, inArray, isNull, lt, or, sql, desc } from 'drizzle-orm';
import { accounts, transactions, persons } from '@/db/schema';
import type { AppDatabase } from '@/db/client';

// ============================================================
// TYPES
// ============================================================

export interface DashboardMetrics {
  // Account metrics
  totalBalance: number;
  businessTotal: number;
  businessCashTotal: number;
  
  // Monthly totals
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyAdjustment: number;
  monthlyNet: number;
  
  // Pending & Overdue (Income)
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  
  // Pending & Overdue (Expense)
  expensePendingCount: number;
  expensePendingTotal: number;
  expenseOverdueCount: number;
  expenseOverdueTotal: number;
  
  // Personal accounts breakdown
  personalAccounts: PersonalAccountSummary[];
  
  // Business accounts breakdown
  businessAccounts: BusinessAccountSummary[];
}

export interface PersonalAccountSummary {
  personId: string;
  personName: string;
  accountId: string;
  accountName: string;
  accountType: string;
  accountNumber: string | null;
  accountAlias: string | null;
  bankName: string | null;
  balance: number;
}

export interface BusinessAccountSummary {
  personId: string;
  personName: string;
  accountId: string;
  accountName: string;
  accountType: string;
  accountNumber: string | null;
  accountAlias: string | null;
  bankName: string | null;
  balance: number;
}

// ============================================================
// TYPES
// ============================================================

// LINE notification metrics interface
export interface LineNotificationItem {
  title: string;
  amount: number;
}

export interface TodaySummary {
  receivedCount: number;
  receivedAmount: number;
  paidCount: number;
  paidAmount: number;
}

export interface LineNotificationMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  pendingItems: LineNotificationItem[];   // top N items (for bullet list)
  overdueItems: LineNotificationItem[];
  today: TodaySummary;                   // today's completed transactions
}

// Query result types
interface AccountMetricsResult {
  totalBalance: number;
  businessTotal: number;
  businessCashTotal: number;
}

interface IncomeExpenseResult {
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  total: number;
}

interface CountTotalResult {
  total: number;
  count: number;
}

interface SimpleTotalResult {
  total: number;
}

interface AccountPersonResult {
  personId: string;
  personName: string;
  accountId: string;
  accountName: string;
  accountType: 'cash' | 'bank';
  accountNumber: string | null;
  accountAlias: string | null;
  bankName: string | null;
  balance: number;
}

// ============================================================
// DATE HELPERS (Bangkok Time)
// ============================================================

/**
 * Get current month range in UTC
 * Used for monthly income/expense calculations
 */
export function getCurrentMonthRange(): { monthStart: Date; nextMonthStart: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

/**
 * Get today's date range for "today" transactions
 * Uses Bangkok timezone (UTC+7)
 * Returns date range in UTC for database query
 */
export function getTodayRange(): { todayStart: Date; todayEnd: Date } {
  const now = new Date();
  // Bangkok timezone = UTC+7, so get today's date in Bangkok
  const bangkokDate = new Date(now.getTime() + (7 * 60 * 60 * 1000));

  // Start of today in Bangkok
  const todayBangkok = new Date(bangkokDate);
  todayBangkok.setHours(0, 0, 0, 0);

  // Convert back to UTC
  const todayStart = new Date(todayBangkok.getTime() - (7 * 60 * 60 * 1000));
  const todayEnd = new Date(todayBangkok.getTime() + (24 * 60 * 60 * 1000) - 1 - (7 * 60 * 60 * 1000));

  return { todayStart, todayEnd };
}

// ============================================================
// MAIN FUNCTION: Get Dashboard Metrics
// ============================================================

/**
 * Get all dashboard metrics from database
 * 
 * This is the SINGLE SOURCE OF TRUTH for all metrics.
 * Reuse this function instead of duplicating queries.
 */
export async function getDashboardMetrics(db: AppDatabase) {
  const { monthStart, nextMonthStart } = getCurrentMonthRange();
  
  // Run all queries in parallel for performance
  const queryResults = await Promise.allSettled([
    // QUERY 1: All account metrics
    db
      .select({
        totalBalance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
        businessTotal: sql<number>`COALESCE(SUM(CASE WHEN ${accounts.isBusinessAccount} = 1 THEN ${accounts.currentBalance} ELSE 0 END), 0)`,
        businessCashTotal: sql<number>`COALESCE(SUM(CASE WHEN ${accounts.isBusinessAccount} = 1 AND ${accounts.accountType} = 'cash' THEN ${accounts.currentBalance} ELSE 0 END), 0)`,
      })
      .from(accounts)
      .where(and(
        inArray(accounts.accountType, ['cash', 'bank']),
        isNull(accounts.deletedAt)
      )),

    // QUERY 2: Monthly income/expense (exclude adjustments)
    db
      .select({
        type: transactions.type,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.status, 'completed'),
        gte(transactions.date, monthStart),
        lt(transactions.date, nextMonthStart),
        or(eq(transactions.type, 'income'), eq(transactions.type, 'expense')),
      ))
      .groupBy(transactions.type),

    // QUERY 2b: Monthly adjustments (separate query)
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.status, 'completed'),
        eq(transactions.type, 'adjustment'),
        gte(transactions.date, monthStart),
        lt(transactions.date, nextMonthStart),
      )),

    // QUERY 3a: Pending income (not yet overdue)
    // Phase 1.2: deadline = COALESCE(due_date_time, date + 126000)
    //   - 126000 = 86400 (1d) + 39600 (Bangkok 18:00 - UTC 11:00 offset)
    //   - If due_date_time IS NULL → fall back to legacy formula
    // Not overdue = now <= deadline
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) > CAST(strftime('%s', 'now') AS INTEGER)`
      )),

    // QUERY 3b: Overdue income
    // Phase 1.2: deadline = COALESCE(due_date_time, date + 126000)
    // Overdue = now > deadline
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) <= CAST(strftime('%s', 'now') AS INTEGER)`
      )),

    // QUERY 3c: Pending expense (not yet overdue)
    // Phase 1.2: deadline = COALESCE(due_date_time, date + 126000)
    // Not overdue = now <= deadline
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'expense'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) > CAST(strftime('%s', 'now') AS INTEGER)`
      )),

    // QUERY 3d: Overdue expense
    // Phase 1.2: deadline = COALESCE(due_date_time, date + 126000)
    // Overdue = now > deadline
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'expense'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) <= CAST(strftime('%s', 'now') AS INTEGER)`
      )),

    // QUERY 5: Personal accounts with person names
    db
      .select({
        personId: persons.id,
        personName: persons.name,
        accountId: accounts.id,
        accountName: accounts.name,
        accountType: accounts.accountType,
        accountNumber: accounts.accountNumber,
        accountAlias: accounts.accountAlias,
        bankName: accounts.bankName,
        balance: accounts.currentBalance,
      })
      .from(accounts)
      .innerJoin(persons, eq(accounts.personId, persons.id))
      .where(and(
        eq(accounts.isBusinessAccount, false),
        inArray(accounts.accountType, ['cash', 'bank']),
        isNull(accounts.deletedAt)
      ))
      .orderBy(desc(accounts.currentBalance)),

    // QUERY 6: Business accounts with person names
    db
      .select({
        personId: persons.id,
        personName: persons.name,
        accountId: accounts.id,
        accountName: accounts.name,
        accountType: accounts.accountType,
        accountNumber: accounts.accountNumber,
        accountAlias: accounts.accountAlias,
        bankName: accounts.bankName,
        balance: accounts.currentBalance,
      })
      .from(accounts)
      .innerJoin(persons, eq(accounts.personId, persons.id))
      .where(and(
        eq(accounts.isBusinessAccount, true),
        inArray(accounts.accountType, ['cash', 'bank']),
        isNull(accounts.deletedAt)
      ))
      .orderBy(desc(accounts.currentBalance)),
  ]);

  // Extract results with type safety
  const accountResult = queryResults[0].status === 'fulfilled' ? queryResults[0].value as AccountMetricsResult[] : [];
  const incomeExpenseResult = queryResults[1].status === 'fulfilled' ? queryResults[1].value as IncomeExpenseResult[] : [];
  const adjustmentResult = queryResults[2].status === 'fulfilled' ? queryResults[2].value as SimpleTotalResult[] : [];
  const pendingResult = queryResults[3].status === 'fulfilled' ? queryResults[3].value as CountTotalResult[] : [];
  const overdueResult = queryResults[4].status === 'fulfilled' ? queryResults[4].value as CountTotalResult[] : [];
  const expensePendingResult = queryResults[5].status === 'fulfilled' ? queryResults[5].value as CountTotalResult[] : [];
  const expenseOverdueResult = queryResults[6].status === 'fulfilled' ? queryResults[6].value as CountTotalResult[] : [];
  const personalAccountsResult = queryResults[7].status === 'fulfilled' ? queryResults[7].value as AccountPersonResult[] : [];
  const businessAccountsResult = queryResults[8].status === 'fulfilled' ? queryResults[8].value as AccountPersonResult[] : [];

  // Account metrics
  const accountMetrics = accountResult[0] || {
    totalBalance: 0,
    businessTotal: 0,
    businessCashTotal: 0,
  };

  // Monthly income/expense
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  
  for (const row of incomeExpenseResult) {
    if (row.type === 'income') {
      monthlyIncome = Number(row.total) || 0;
    } else if (row.type === 'expense') {
      monthlyExpense = Number(row.total) || 0;
    }
  }

  // Monthly adjustment
  const monthlyAdjustment = adjustmentResult[0]?.total || 0;

  // Pending & Overdue
  const pendingMetrics = pendingResult[0] || { total: 0, count: 0 };
  const overdueMetrics = overdueResult[0] || { total: 0, count: 0 };
  
  // Expense Pending & Overdue
  const expensePendingMetrics = expensePendingResult[0] || { total: 0, count: 0 };
  const expenseOverdueMetrics = expenseOverdueResult[0] || { total: 0, count: 0 };

  // Personal & Business accounts
  const personalAccounts: PersonalAccountSummary[] = personalAccountsResult.map(r => ({
    personId: r.personId,
    personName: r.personName,
    accountId: r.accountId,
    accountName: r.accountName,
    accountType: r.accountType,
    accountNumber: r.accountNumber,
    accountAlias: r.accountAlias,
    bankName: r.bankName,
    balance: r.balance,
  }));

  const businessAccounts: BusinessAccountSummary[] = businessAccountsResult.map(r => ({
    personId: r.personId,
    personName: r.personName,
    accountId: r.accountId,
    accountName: r.accountName,
    accountType: r.accountType,
    accountNumber: r.accountNumber,
    accountAlias: r.accountAlias,
    bankName: r.bankName,
    balance: r.balance,
  }));

  return {
    // Account metrics
    totalBalance: Number(accountMetrics.totalBalance) || 0,
    businessTotal: Number(accountMetrics.businessTotal) || 0,
    businessCashTotal: Number(accountMetrics.businessCashTotal) || 0,
    
    // Monthly totals
    monthlyIncome,
    monthlyExpense,
    monthlyAdjustment: Number(monthlyAdjustment) || 0,
    monthlyNet: monthlyIncome - monthlyExpense,
    
    // Pending & Overdue (Income)
    pendingCount: Number(pendingMetrics.count) || 0,
    pendingTotal: Number(pendingMetrics.total) || 0,
    overdueCount: Number(overdueMetrics.count) || 0,
    overdueTotal: Number(overdueMetrics.total) || 0,
    
    // Pending & Overdue (Expense)
    expensePendingCount: Number(expensePendingMetrics.count) || 0,
    expensePendingTotal: Number(expensePendingMetrics.total) || 0,
    expenseOverdueCount: Number(expenseOverdueMetrics.count) || 0,
    expenseOverdueTotal: Number(expenseOverdueMetrics.total) || 0,
    
    // Account breakdowns
    personalAccounts,
    businessAccounts,
  };
}

// ============================================================
// SIMPLIFIED FUNCTION: For LINE Notification
// ============================================================

/**
 * Get metrics specifically for LINE notification
 * Only returns the fields needed for daily summary
 */
export async function getLineNotificationMetrics(db: AppDatabase): Promise<LineNotificationMetrics> {
  const { monthStart, nextMonthStart } = getCurrentMonthRange();
  const { todayStart, todayEnd } = getTodayRange();

  // 🚨 AUDIT: Dump today query params
  const nowTs = Math.floor(Date.now() / 1000);
  console.log('[getLineNotificationMetrics] today query params:', { todayStart, todayEnd, now: nowTs });

  // Run only the queries we need
  const queryResults = await Promise.allSettled([
    // Total Balance
    db
      .select({
        totalBalance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
      })
      .from(accounts)
      .where(and(
        inArray(accounts.accountType, ['cash', 'bank']),
        isNull(accounts.deletedAt)
      )),

    // Monthly income/expense
    db
      .select({
        type: transactions.type,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.status, 'completed'),
        gte(transactions.date, monthStart),
        lt(transactions.date, nextMonthStart),
        or(eq(transactions.type, 'income'), eq(transactions.type, 'expense')),
      ))
      .groupBy(transactions.type),

    // Pending (not yet overdue)
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) > CAST(strftime('%s', 'now') AS INTEGER)`
      )),

    // Overdue
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) <= CAST(strftime('%s', 'now') AS INTEGER)`
      )),

    // Pending items (top 5 ordered by oldest)
    db
      .select({
        title: transactions.title,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) > CAST(strftime('%s', 'now') AS INTEGER)`
      ))
      .orderBy(transactions.date)
      .limit(5),

    // Overdue items (top 5 ordered by oldest first)
    db
      .select({
        title: transactions.title,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        sql`COALESCE(${transactions.dueDateTime}, ${transactions.date} + 126000) <= CAST(strftime('%s', 'now') AS INTEGER)`
      ))
      .orderBy(transactions.date)
      .limit(5),

    // Today's Transactions (completed only) - for Flex "รายการวันนี้" section
    db
      .select({
        type: transactions.type,
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.status, 'completed'),
        gte(transactions.date, todayStart),
        lt(transactions.date, todayEnd)
      ))
      .groupBy(transactions.type),
  ]);

  // Extract results with type safety
  const balanceResult = queryResults[0].status === 'fulfilled' ? queryResults[0].value as { totalBalance: number }[] : [];
  const incomeExpenseResult = queryResults[1].status === 'fulfilled' ? queryResults[1].value as IncomeExpenseResult[] : [];
  const pendingResult = queryResults[2].status === 'fulfilled' ? queryResults[2].value as CountTotalResult[] : [];
  const overdueResult = queryResults[3].status === 'fulfilled' ? queryResults[3].value as CountTotalResult[] : [];
  const pendingItemsResult = queryResults[4].status === 'fulfilled' ? queryResults[4].value as LineNotificationItem[] : [];
  const overdueItemsResult = queryResults[5].status === 'fulfilled' ? queryResults[5].value as LineNotificationItem[] : [];
  const todayResult = queryResults[6].status === 'fulfilled' ? queryResults[6].value as { type: string; count: number; total: number }[] : [];

  // 🚨 AUDIT: Dump today query result raw
  console.log('[getLineNotificationMetrics] today query raw result:', todayResult);
  
  // Total Balance
  const totalBalance = Number(balanceResult[0]?.totalBalance) || 0;

  // Monthly Income/Expense
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  for (const row of incomeExpenseResult) {
    if (row.type === 'income') {
      monthlyIncome = Number(row.total) || 0;
    } else if (row.type === 'expense') {
      monthlyExpense = Number(row.total) || 0;
    }
  }

  // Pending & Overdue
  const pendingMetrics = pendingResult[0] || { total: 0, count: 0 };
  const overdueMetrics = overdueResult[0] || { total: 0, count: 0 };

  // Today's Transactions - separate received vs paid
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

  console.log('[getLineNotificationMetrics] today:', {
    receivedCount: todayReceivedCount,
    receivedAmount: todayReceivedAmount,
    paidCount: todayPaidCount,
    paidAmount: todayPaidAmount,
  });

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    pendingCount: Number(pendingMetrics.count) || 0,
    pendingTotal: Number(pendingMetrics.total) || 0,
    overdueCount: Number(overdueMetrics.count) || 0,
    overdueTotal: Number(overdueMetrics.total) || 0,
    pendingItems: pendingItemsResult.map((it) => ({ title: it.title, amount: Number(it.amount) || 0 })),
    overdueItems: overdueItemsResult.map((it) => ({ title: it.title, amount: Number(it.amount) || 0 })),
    today: {
      receivedCount: todayReceivedCount,
      receivedAmount: todayReceivedAmount,
      paidCount: todayPaidCount,
      paidAmount: todayPaidAmount,
    },
  };
}
