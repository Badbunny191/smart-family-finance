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
  
  // Pending & Overdue
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  
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
        isNull(transactions.deletedAt)
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
        isNull(transactions.deletedAt)
      )),

    // QUERY 3a: Pending income (not yet overdue)
    // deadline = date (Bangkok) + 1 day at 18:00 (Bangkok time)
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
        isNull(transactions.deletedAt),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
      )),

    // QUERY 3b: Overdue income
    // deadline = date (Bangkok) + 1 day at 18:00 (Bangkok time)
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
        isNull(transactions.deletedAt),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
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
  const personalAccountsResult = queryResults[5].status === 'fulfilled' ? queryResults[5].value as AccountPersonResult[] : [];
  const businessAccountsResult = queryResults[6].status === 'fulfilled' ? queryResults[6].value as AccountPersonResult[] : [];

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
    
    // Pending & Overdue
    pendingCount: Number(pendingMetrics.count) || 0,
    pendingTotal: Number(pendingMetrics.total) || 0,
    overdueCount: Number(overdueMetrics.count) || 0,
    overdueTotal: Number(overdueMetrics.total) || 0,
    
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
        isNull(transactions.deletedAt)
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
        isNull(transactions.deletedAt),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
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
        isNull(transactions.deletedAt),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
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
        isNull(transactions.deletedAt),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
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
        isNull(transactions.deletedAt),
        sql`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
      ))
      .orderBy(transactions.date)
      .limit(5),
  ]);

  // Extract results with type safety
  const balanceResult = queryResults[0].status === 'fulfilled' ? queryResults[0].value as { totalBalance: number }[] : [];
  const incomeExpenseResult = queryResults[1].status === 'fulfilled' ? queryResults[1].value as IncomeExpenseResult[] : [];
  const pendingResult = queryResults[2].status === 'fulfilled' ? queryResults[2].value as CountTotalResult[] : [];
  const overdueResult = queryResults[3].status === 'fulfilled' ? queryResults[3].value as CountTotalResult[] : [];
  const pendingItemsResult = queryResults[4].status === 'fulfilled' ? queryResults[4].value as LineNotificationItem[] : [];
  const overdueItemsResult = queryResults[5].status === 'fulfilled' ? queryResults[5].value as LineNotificationItem[] : [];

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
  };
}
