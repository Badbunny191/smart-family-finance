import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Building2, ChevronRight, CircleDollarSign, PiggyBank, TrendingUp, TrendingDown, Percent, Droplets } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';

// Alias for self-join (source and destination accounts)
const sourceAccountAlias = alias(accounts, 'source_account');
const destinationAccountAlias = alias(accounts, 'destination_account');

export const runtime = 'nodejs';

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

    // QUERY 2: Monthly income/expense
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

    // QUERY 4: Recent transactions (include all types: income, expense, transfer)
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
        destinationAccountName: destinationAccountAlias.name,
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

    // QUERY 5: Business accounts with person names
    db
      .select({
        personId: persons.id,
        personName: persons.name,
        balance: accounts.currentBalance,
        accountName: accounts.name,
      })
      .from(accounts)
      .innerJoin(persons, eq(accounts.personId, persons.id))
      .where(and(
        eq(accounts.isBusinessAccount, true),
        isNull(accounts.deletedAt)
      )),

    // QUERY 6: Personal accounts grouped by person
    db
      .select({
        personId: persons.id,
        personName: persons.name,
        balance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
      })
      .from(accounts)
      .innerJoin(persons, eq(accounts.personId, persons.id))
      .where(and(
        eq(accounts.isBusinessAccount, false),
        isNull(accounts.deletedAt)
      ))
      .groupBy(persons.id, persons.name),
  ]);

  // Extract results
  const [accountMetrics, monthlyMetrics, pendingResult, recentRows, businessAccounts, personalByPerson] = queryResults.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  );

  // Type definitions
  type AccountMetricsRow = { totalBalance: number; businessTotal: number; businessCashTotal: number } | null;
  type MonthlyMetricsRow = { type: string; total: number } | null;
  type PendingRow = { total: number; count: number } | null;
  type BusinessAccountRow = { personId: string; personName: string; balance: number; accountName: string } | null;
  type PersonalAccountRow = { personId: string; personName: string; balance: number } | null;

  const typedAccountMetrics = accountMetrics as AccountMetricsRow[];
  const typedMonthlyMetrics = monthlyMetrics as MonthlyMetricsRow[];
  const typedPendingResult = pendingResult as PendingRow[];
  const typedBusinessAccounts = businessAccounts as BusinessAccountRow[];
  const typedPersonalByPerson = personalByPerson as PersonalAccountRow[];

  // Process monthly metrics
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

  // ========== COMPUTED VALUES ==========

  const totalBalance = Number(typedAccountMetrics?.[0]?.totalBalance) || 0;
  const businessTotal = Number(typedAccountMetrics?.[0]?.businessTotal) || 0;
  const businessCashTotal = Number(typedAccountMetrics?.[0]?.businessCashTotal) || 0;
  const personalTotal = totalBalance - businessTotal;
  const netBalance = monthlyIncome - monthlyExpense;

  // Financial Health KPIs
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;
  const cashRatio = totalBalance > 0 ? Math.round((businessCashTotal / totalBalance) * 100) : 0;
  const businessRatio = totalBalance > 0 ? Math.round((businessTotal / totalBalance) * 100) : 0;

  // KPI thresholds
  const getSavingsColor = (rate: number) => {
    if (rate >= 30) return 'text-emerald-600';
    if (rate >= 10) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getCashColor = (ratio: number) => {
    if (ratio >= 50) return 'text-emerald-600';
    if (ratio >= 20) return 'text-amber-600';
    return 'text-rose-600';
  };

  const data = {
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    recentTransactions: (recentRows ?? []) as { id: string; type: 'income' | 'expense' | 'transfer'; amount: number; date: Date; title: string; status: string; sourceAccountId: string | null; destinationAccountId: string | null; note: string | null; createdAt: Date; sourceAccountName: string | null; destinationAccountName: string | null }[],
    pending: {
      total: Number(typedPendingResult?.[0]?.total) || 0,
      count: Number(typedPendingResult?.[0]?.count) || 0
    },
    businessAccounts: (typedBusinessAccounts ?? []) as { personId: string; personName: string; balance: number; accountName: string }[],
    businessTotal,
    businessCashTotal,
    personalByPerson: (typedPersonalByPerson ?? []) as { personId: string; personName: string; balance: number }[],
    personalTotal,
    savingsRate,
    cashRatio,
    businessRatio,
  };

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="border-b border-slate-200/70 bg-white px-5 pb-6 pt-7">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <p className="section-label">Dashboard</p>
            <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">สวัสดี, {session.user.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{session.user.email}</p>
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
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">การจัดการ</h2>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/transactions?type=income" prefetch={false} className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CircleDollarSign size={20} />
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">รายรับใหม่</p>
            </Link>
            <Link href="/transactions?type=expense" prefetch={false} className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">รายจ่ายใหม่</p>
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
            BUSINESS ACCOUNTS - Full Width
            ======================================== */}
        {data.businessTotal > 0 && data.businessAccounts.length > 0 && (
          <section>
            <Link
              href="/accounts?type=business"
              prefetch={false}
              className="surface-card block overflow-hidden transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">บัญชีธุรกิจ</p>
                    <p className="font-bold text-slate-900">{formatCurrency(data.businessTotal)}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-400" />
              </div>
              <div className="divide-y divide-slate-100">
                {data.businessAccounts.map((acc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 text-sm">
                    <span className="text-slate-700">{acc.personName}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
              </div>
            </Link>
          </section>
        )}

        {/* ========================================
            PERSONAL ACCOUNTS - Full Width
            ======================================== */}
        {(data.personalTotal >= 0 || data.personalByPerson.length > 0) && (
          <section>
            <Link
              href="/accounts?type=personal"
              prefetch={false}
              className="surface-card block overflow-hidden transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                    <PiggyBank size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">บัญชีส่วนตัว</p>
                    <p className="font-bold text-slate-900">{formatCurrency(data.personalTotal)}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-400" />
              </div>
              <div className="divide-y divide-slate-100">
                {data.personalByPerson.map((person) => (
                  <div key={person.personId} className="flex items-center justify-between p-3 text-sm">
                    <span className="text-slate-700">{person.personName}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(person.balance)}</span>
                  </div>
                ))}
              </div>
            </Link>
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
                const iconBg = tx.type === 'income' ? 'bg-emerald-50 text-emerald-700' : tx.type === 'expense' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700';
                const amountColor = tx.type === 'income' ? 'text-emerald-700' : tx.type === 'expense' ? 'text-rose-700' : 'text-slate-700';
                const typeLabel = tx.type === 'income' ? 'รายรับ' : tx.type === 'expense' ? 'รายจ่าย' : 'โอนเงิน';
                const iconElement = tx.type === 'income' ? <ArrowDownLeft size={19} /> : tx.type === 'expense' ? <ArrowUpRight size={19} /> : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                );

                // Account display based on transaction type
                // Income: show destination account (where money goes in)
                // Expense: show source account (where money goes out)
                // Transfer: show source → destination
                const accountDisplay = tx.type === 'transfer'
                  ? (tx.sourceAccountName && tx.destinationAccountName
                    ? `${tx.sourceAccountName} → ${tx.destinationAccountName}`
                    : tx.sourceAccountName || tx.destinationAccountName || '')
                  : tx.type === 'income'
                    ? (tx.destinationAccountName || tx.sourceAccountName || '')
                    : (tx.sourceAccountName || '');

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
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
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
