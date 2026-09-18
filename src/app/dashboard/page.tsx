import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Building2, ChevronDown, ChevronRight, CircleDollarSign, PiggyBank, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { MobileNav } from '@/components/mobile-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { accounts, persons, transactions } from '@/db/schema';
import { getDb } from '@/db/client';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { formatAccountDisplayName, formatCurrency } from '@/lib/utils';
import { PersonAccordionCard } from './_components/person-accordion-card';

// Alias for self-join (source and destination accounts)
const sourceAccountAlias = alias(accounts, 'source_account');
const destinationAccountAlias = alias(accounts, 'destination_account');

export const runtime = 'nodejs';

// Type definitions
type AccountRow = {
  id: string;
  name: string;
  accountType: 'cash' | 'bank';
  accountAlias: string | null;
  accountNumber: string | null;
  bankName: string | null;
  currentBalance: number;
};

type PersonWithAccounts = {
  personId: string;
  personName: string;
  totalBalance: number;
  accounts: AccountRow[];
};

type BusinessPersonWithAccounts = {
  personId: string;
  personName: string;
  totalBalance: number;
  accounts: AccountRow[];
};

export default async function DashboardPage() {
  const requestHeaders = await headers();

  const d1 = await getD1();
  const session = await createAuth(d1).api.getSession({ headers: requestHeaders });

  if (!session) redirect('/login');

  const db = getDb(d1);

  // วันที่ของเดือนปัจจุบัน (UTC)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

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

    // QUERY 3: Pending income
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.businessStatus, 'pending'),
        isNull(transactions.deletedAt)
      )),

    // QUERY 4: Recent transactions (include all types: income, expense, transfer, adjustment)
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
        title: transactions.title,
        status: transactions.status,
        sourceAccountId: transactions.sourceAccountId,
        destinationAccountId: transactions.destinationAccountId,
        note: transactions.note,
        createdAt: transactions.createdAt,
        sourceAccountName: sourceAccountAlias.name,
        sourceAccountAlias: sourceAccountAlias.accountAlias,
        sourceAccountBank: sourceAccountAlias.bankName,
        sourceAccountNumber: sourceAccountAlias.accountNumber,
        sourceAccountType: sourceAccountAlias.accountType,
        destinationAccountName: destinationAccountAlias.name,
        destinationAccountAlias: destinationAccountAlias.accountAlias,
        destinationAccountBank: destinationAccountAlias.bankName,
        destinationAccountNumber: destinationAccountAlias.accountNumber,
        destinationAccountType: destinationAccountAlias.accountType,
        adjustmentDirection: transactions.adjustmentDirection,
      })
      .from(transactions)
      .leftJoin(sourceAccountAlias, eq(transactions.sourceAccountId, sourceAccountAlias.id))
      .leftJoin(destinationAccountAlias, eq(transactions.destinationAccountId, destinationAccountAlias.id))
      .where(and(
        eq(transactions.status, 'completed'),
        isNull(transactions.deletedAt)
      ))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(10),

    // QUERY 5: Personal accounts with person names (grouped by person)
    // Order by account balance DESC - will sort persons by total in JS
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

    // QUERY 6: Business accounts with person names (grouped by person)
    // Order by account balance DESC - will sort persons by total in JS
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

  // Extract results
  const [accountMetrics, monthlyMetrics, monthlyAdjustments, pendingResult, recentRows, personalAccountsRows, businessAccountsRows] = queryResults.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  );

  // Type definitions
  type AccountMetricsRow = { totalBalance: number; businessTotal: number; businessCashTotal: number } | null;
  type MonthlyMetricsRow = { type: string; total: number } | null;
  type PendingRow = { total: number; count: number } | null;
  type MonthlyAdjustmentsRow = { total: number } | null;
  type PersonalAccountRow = { personId: string; personName: string; accountId: string; accountName: string; accountType: 'cash' | 'bank'; accountNumber: string | null; accountAlias: string | null; bankName: string | null; balance: number } | null;
  type BusinessAccountRow = { personId: string; personName: string; accountId: string; accountName: string; accountType: 'cash' | 'bank'; accountNumber: string | null; accountAlias: string | null; bankName: string | null; balance: number } | null;

  const typedAccountMetrics = accountMetrics as AccountMetricsRow[];
  const typedMonthlyMetrics = monthlyMetrics as MonthlyMetricsRow[];
  const typedPendingResult = pendingResult as PendingRow[];
  const typedMonthlyAdjustments = monthlyAdjustments as MonthlyAdjustmentsRow[];
  const typedPersonalAccountsRows = (personalAccountsRows ?? []) as (PersonalAccountRow & { personId: string; accountId: string })[];
  const typedBusinessAccountsRows = (businessAccountsRows ?? []) as (BusinessAccountRow & { personId: string; accountId: string })[];

  // Process monthly metrics (income + expense only, NOT adjustments)
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  if (typedMonthlyMetrics && Array.isArray(typedMonthlyMetrics)) {
    for (const row of typedMonthlyMetrics) {
      if (row && row.type === 'income') {
        monthlyIncome = Number(row.total) || 0;
      } else if (row && row.type === 'expense') {
        monthlyExpense = Number(row.total) || 0;
      }
    }
  }

  // Process monthly adjustments separately
  const monthlyAdjustmentTotal = Number(typedMonthlyAdjustments?.[0]?.total) || 0;

  // ========== COMPUTED VALUES ==========

  const totalBalance = Number(typedAccountMetrics?.[0]?.totalBalance) || 0;
  const businessTotal = Number(typedAccountMetrics?.[0]?.businessTotal) || 0;
  const businessCashTotal = Number(typedAccountMetrics?.[0]?.businessCashTotal) || 0;
  const personalTotal = totalBalance - businessTotal;
  // Net balance = income - expense (NOT including adjustments)
  const netBalance = monthlyIncome - monthlyExpense;

  // Financial Health KPIs
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;
  const cashRatio = totalBalance > 0 ? Math.round((businessCashTotal / totalBalance) * 100) : 0;
  const businessRatio = totalBalance > 0 ? Math.round((businessTotal / totalBalance) * 100) : 0;

  // Process personal accounts - group by person
  // Order: Account by balance DESC, then Person by totalBalance DESC
  const personalByPerson: PersonWithAccounts[] = [];
  const personalMap = new Map<string, PersonWithAccounts>();

  for (const row of typedPersonalAccountsRows) {
    if (!row) continue;
    if (!personalMap.has(row.personId)) {
      personalMap.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        totalBalance: 0,
        accounts: [],
      });
    }
    const person = personalMap.get(row.personId)!;
    person.totalBalance += Number(row.balance) || 0;
    person.accounts.push({
      id: row.accountId,
      name: row.accountName,
      accountType: row.accountType,
      accountAlias: row.accountAlias,
      accountNumber: row.accountNumber,
      bankName: row.bankName,
      currentBalance: Number(row.balance) || 0,
    });
  }

  // Sort accounts within person by balance DESC, then sort persons by totalBalance DESC
  personalByPerson.push(
    ...Array.from(personalMap.values())
      .map((person) => ({
        ...person,
        accounts: person.accounts.sort((a, b) => b.currentBalance - a.currentBalance),
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance)
  );

  // Process business accounts - group by person
  // Order: Account by balance DESC, then Person by totalBalance DESC
  const businessByPerson: BusinessPersonWithAccounts[] = [];
  const businessMap = new Map<string, BusinessPersonWithAccounts>();

  for (const row of typedBusinessAccountsRows) {
    if (!row) continue;
    if (!businessMap.has(row.personId)) {
      businessMap.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        totalBalance: 0,
        accounts: [],
      });
    }
    const person = businessMap.get(row.personId)!;
    person.totalBalance += Number(row.balance) || 0;
    person.accounts.push({
      id: row.accountId,
      name: row.accountName,
      accountType: row.accountType,
      accountAlias: row.accountAlias,
      accountNumber: row.accountNumber,
      bankName: row.bankName,
      currentBalance: Number(row.balance) || 0,
    });
  }

  // Sort accounts within person by balance DESC, then sort persons by totalBalance DESC
  businessByPerson.push(
    ...Array.from(businessMap.values())
      .map((person) => ({
        ...person,
        accounts: person.accounts.sort((a, b) => b.currentBalance - a.currentBalance),
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance)
  );

  const data = {
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    monthlyAdjustmentTotal,
    recentTransactions: (recentRows ?? []) as {
      id: string;
      type: 'income' | 'expense' | 'transfer' | 'adjustment';
      amount: number;
      date: Date;
      title: string;
      status: string;
      sourceAccountId: string | null;
      destinationAccountId: string | null;
      note: string | null;
      createdAt: Date;
      sourceAccountName: string | null;
      sourceAccountAlias: string | null;
      sourceAccountBank: string | null;
      sourceAccountNumber: string | null;
      sourceAccountType: 'bank' | 'cash' | null;
      destinationAccountName: string | null;
      destinationAccountAlias: string | null;
      destinationAccountBank: string | null;
      destinationAccountNumber: string | null;
      destinationAccountType: 'bank' | 'cash' | null;
      adjustmentDirection: 'increase' | 'decrease' | null;
    }[],
    pending: {
      total: Number(typedPendingResult?.[0]?.total) || 0,
      count: Number(typedPendingResult?.[0]?.count) || 0
    },
    businessTotal,
    businessCashTotal,
    personalTotal,
    personalByPerson,
    businessByPerson,
    savingsRate,
    cashRatio,
    businessRatio,
  };

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="border-b border-slate-200/70 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{session.user.name}</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-5 py-6">

        {/* ========================================
            ASSET BREAKDOWN SECTION
            ======================================== */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">สินทรัพย์รวม</h2>

          {/* Hero: Total Balance */}
          <Link
            href="/accounts"
            prefetch={false}
            className="surface-card block overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 p-5 text-white transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100">ยอดรวมทั้งหมด</p>
                <p className="mt-2 text-[2rem] font-bold tracking-tight">
                  {formatCurrency(data.totalBalance)}
                </p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
                <CircleDollarSign size={22} />
              </div>
            </div>
          </Link>
        </section>

        {/* ========================================
            QUICK ACTIONS
            ======================================== */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">ดูรายการ</h2>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/transactions?type=income" prefetch={false} className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CircleDollarSign size={20} />
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">รายรับ</p>
            </Link>
            <Link href="/transactions?type=expense" prefetch={false} className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">รายจ่าย</p>
            </Link>
            <Link href="/transactions?type=transfer" prefetch={false} className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">โอนเงิน</p>
            </Link>
          </div>
        </section>

        {/* ========================================
            BUSINESS ACCOUNTS - Accordion
            ======================================== */}
        {data.businessByPerson.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">บัญชีธุรกิจ</h2>
              <span className="text-sm font-bold text-slate-700">{formatCurrency(data.businessTotal)}</span>
            </div>
            <PersonAccordionCard
              persons={data.businessByPerson}
              variant="business"
            />
          </section>
        )}

        {/* ========================================
            PERSONAL ACCOUNTS - Accordion
            ======================================== */}
        {data.personalByPerson.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">บัญชีส่วนตัว</h2>
              <span className="text-sm font-bold text-slate-700">{formatCurrency(data.personalTotal)}</span>
            </div>
            <PersonAccordionCard
              persons={data.personalByPerson}
              variant="personal"
            />
          </section>
        )}

        {/* ========================================
            MONTHLY CASH FLOW
            ======================================== */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">กระแสเงินสดเดือนนี้</h2>
          {/* Hero card - Net Balance */}
          <Link
            href="/transactions"
            prefetch={false}
            className={`surface-card block overflow-hidden p-5 transition-transform active:scale-[0.98] ${netBalance >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}
          >
            <p className="text-center text-sm font-medium text-white/80">คงเหลือสุทธิ</p>
            <p className="mt-1 text-center text-2xl font-bold text-white">
              {formatCurrency(netBalance)}
            </p>
          </Link>

          {/* Income + Expense row */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link
              href="/transactions?type=income"
              prefetch={false}
              className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">รายรับ</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {formatCurrency(data.monthlyIncome)}
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/transactions?type=expense"
              prefetch={false}
              className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <TrendingDown size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">รายจ่าย</p>
                  <p className="text-sm font-bold text-rose-700">
                    {formatCurrency(data.monthlyExpense)}
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Adjustment Card - Only show if there are adjustments */}
          {data.monthlyAdjustmentTotal !== 0 && (
            <Link
              href="/transactions?type=adjustment"
              prefetch={false}
              className="surface-card mt-3 block overflow-hidden p-4 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">ปรับยอดบัญชี</p>
                  <p className={`text-sm font-bold ${data.monthlyAdjustmentTotal >= 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                    {data.monthlyAdjustmentTotal >= 0 ? '+' : ''}{formatCurrency(data.monthlyAdjustmentTotal)}
                  </p>
                </div>
              </div>
            </Link>
          )}
        </section>

        {/* ========================================
            PENDING ACTIONS
            ======================================== */}
        {data.pending.total > 0 && (
          <section>
            <Link
              href="/transactions?type=income&businessStatus=pending"
              prefetch={false}
              className="surface-card flex items-center justify-between overflow-hidden p-4 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">รอชำระ</p>
                  <p className="text-xs text-slate-500">{data.pending.count} รายการ</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-amber-700">
                  {formatCurrency(data.pending.total)}
                </p>
              </div>
            </Link>
          </section>
        )}

        {/* ========================================
            RECENT TRANSACTIONS
            ======================================== */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">รายการล่าสุด</h2>
            <Link href="/transactions" prefetch={false} className="touch-button px-1 text-sm font-semibold text-emerald-700">
              ดูทั้งหมด
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <div className="surface-card flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">ยังไม่มีรายการ</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.recentTransactions.map((tx) => {
                const iconBg = tx.type === 'income' ? 'bg-emerald-50 text-emerald-700' : tx.type === 'expense' ? 'bg-rose-50 text-rose-700' : tx.type === 'adjustment' ? 'bg-orange-50 text-orange-700' : 'bg-indigo-50 text-indigo-700';
                const amountColor = tx.type === 'income' ? 'text-emerald-700' : tx.type === 'expense' ? 'text-rose-700' : tx.type === 'adjustment' ? 'text-orange-700' : 'text-slate-700';
                const typeLabel = tx.type === 'income' ? 'รายรับ' : tx.type === 'expense' ? 'รายจ่าย' : tx.type === 'adjustment' ? 'ปรับยอด' : 'โอนเงิน';
                const iconElement = tx.type === 'income' ? <ArrowDownLeft size={19} /> : tx.type === 'expense' ? <ArrowUpRight size={19} /> : tx.type === 'adjustment' ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                );

                const sourceLabel = tx.sourceAccountId
                  ? formatAccountDisplayName({
                      accountType: tx.sourceAccountType ?? 'bank',
                      accountAlias: tx.sourceAccountAlias,
                      bankName: tx.sourceAccountBank,
                      accountNumber: tx.sourceAccountNumber,
                    })
                  : null;
                const destLabel = tx.destinationAccountId
                  ? formatAccountDisplayName({
                      accountType: tx.destinationAccountType ?? 'bank',
                      accountAlias: tx.destinationAccountAlias,
                      bankName: tx.destinationAccountBank,
                      accountNumber: tx.destinationAccountNumber,
                    })
                  : null;

                const accountDisplay = tx.type === 'transfer'
                  ? (sourceLabel && destLabel ? `${sourceLabel} → ${destLabel}` : sourceLabel || destLabel || '')
                  : tx.type === 'income'
                    ? (destLabel || sourceLabel || '')
                    : (sourceLabel || '');

                return (
                  <article key={tx.id} className="surface-card flex items-start gap-3 overflow-hidden p-4">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${iconBg}`}>
                      {iconElement}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-900">{tx.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {typeLabel} · {new Date(tx.date).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                        <p className={`shrink-0 font-bold ${amountColor}`}>
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : tx.type === 'adjustment' ? (tx.adjustmentDirection === 'increase' ? '+' : '-') : ''}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                      {accountDisplay && (
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {accountDisplay}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <MobileNav />
    </main>
  );
}
