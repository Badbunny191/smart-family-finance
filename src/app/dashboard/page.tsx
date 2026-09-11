import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Building2, CircleDollarSign, PiggyBank, Wallet } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { MobileNav } from '@/components/mobile-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { accounts, persons, transactions } from '@/db/schema';
import { getDb } from '@/db/client';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { formatCurrency } from '@/lib/utils';

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

  // OPTIMIZED: 6 queries instead of 8
  // Key optimizations:
  // 1. Accounts: 1 query with CASE WHEN instead of 3 separate queries
  // 2. Transactions: 2 queries (monthly metrics + pending) instead of 3
  // 3. Recent transactions: kept separate for ORDER BY
  // 4. Business/Personal accounts: kept for person names
  const queryResults = await Promise.allSettled([
    // QUERY 1: All account metrics in ONE query (was 3 queries)
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

    // QUERY 2: Monthly income/expense with date filter (was 2 queries)
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

    // QUERY 3: Pending income (no date filter - ALL pending regardless of when created)
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

    // QUERY 4: Recent transactions (kept separate for ORDER BY)
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
        sourceAccountName: accounts.name,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.sourceAccountId, accounts.id))
      .where(and(
        or(eq(transactions.type, 'income'), eq(transactions.type, 'expense')),
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

  // Extract results with fallbacks
  const [accountMetrics, monthlyMetrics, pendingResult, recentRows, businessAccounts, personalByPerson] = queryResults.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(`[Dashboard] Query ${index + 1} failed:`, result.reason);
    return null;
  });

  // Type definitions for query results
  type AccountMetricsRow = { totalBalance: number; businessTotal: number; businessCashTotal: number } | null;
  type MonthlyMetricsRow = { type: string; total: number } | null;
  type PendingRow = { total: number; count: number } | null;
  type BusinessAccountRow = { personId: string; personName: string; balance: number; accountName: string } | null;
  type PersonalAccountRow = { personId: string; personName: string; balance: number } | null;

  const typedAccountMetrics = accountMetrics as AccountMetricsRow[] | null;
  const typedMonthlyMetrics = monthlyMetrics as MonthlyMetricsRow[] | null;
  const typedPendingResult = pendingResult as PendingRow[] | null;
  const typedBusinessAccounts = businessAccounts as BusinessAccountRow[] | null;
  const typedPersonalByPerson = personalByPerson as PersonalAccountRow[] | null;

  // Process monthly metrics from grouped result
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

  const data = {
    totalBalance: Number(typedAccountMetrics?.[0]?.totalBalance) || 0,
    monthlyIncome,
    monthlyExpense,
    recentTransactions: (recentRows ?? []) as { id: string; type: 'income' | 'expense' | 'transfer'; amount: number; date: Date; title: string; status: string; sourceAccountId: string | null; destinationAccountId: string | null; note: string | null; createdAt: Date; sourceAccountName: string | null }[],
    pending: {
      total: Number(typedPendingResult?.[0]?.total) || 0,
      count: Number(typedPendingResult?.[0]?.count) || 0
    },
    businessAccounts: (typedBusinessAccounts ?? []) as { personId: string; personName: string; balance: number; accountName: string }[],
    businessTotal: Number(typedAccountMetrics?.[0]?.businessTotal) || 0,
    businessCashTotal: Number(typedAccountMetrics?.[0]?.businessCashTotal) || 0,
    personalByPerson: (typedPersonalByPerson ?? []) as { personId: string; personName: string; balance: number }[],
  };

  const netBalance = data.monthlyIncome - data.monthlyExpense;

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="border-b border-slate-200/70 bg-white px-5 pb-6 pt-7">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <p className="section-label">Action Center</p>
            <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">สวัสดี, {session.user.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{session.user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        {/* ========================================
            OVERVIEW SECTION — ภาพรวมการเงิน
            ======================================== */}

        {/* ยอดเงินคงเหลือรวม */}
        <Link 
          href="/accounts"
          prefetch={false}
          className="surface-card block overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 p-5 text-white transition-transform active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-100">ยอดเงินคงเหลือรวม</p>
              <p className="mt-2 text-[2rem] font-bold tracking-tight">
                {formatCurrency(data.totalBalance)}
              </p>
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
              <CircleDollarSign size={22} />
            </div>
          </div>
        </Link>

        {/* KPI เดือนนี้: รายรับ | รายจ่าย | คงเหลือสุทธิ */}
        <div className="grid grid-cols-3 gap-3">
          <Link 
            href="/transactions?type=income"
            prefetch={false}
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <p className="text-xs font-medium text-slate-500">รายรับเดือนนี้</p>
            <p className="mt-1 truncate text-lg font-bold tracking-tight text-emerald-700">
              {formatCurrency(data.monthlyIncome)}
            </p>
          </Link>
          <Link 
            href="/transactions?type=expense"
            prefetch={false}
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <p className="text-xs font-medium text-slate-500">รายจ่ายเดือนนี้</p>
            <p className="mt-1 truncate text-lg font-bold tracking-tight text-rose-700">
              {formatCurrency(data.monthlyExpense)}
            </p>
          </Link>
          <Link 
            href="/transactions"
            prefetch={false}
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <p className="text-xs font-medium text-slate-500">คงเหลือสุทธิ</p>
            <p className={`mt-1 truncate text-lg font-bold tracking-tight ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(netBalance)}
            </p>
          </Link>
        </div>

        {/* ========================================
            ACTION CENTER SECTION
            ======================================== */}
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-900">Action Center</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {/* รอชำระ */}
          <Link 
            href="/transactions?type=income&businessStatus=pending"
            prefetch={false}
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertTriangle size={22} />
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {data.pending.count} รายการ
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">รอชำระ</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {formatCurrency(data.pending.total)}
            </p>
          </Link>

          {/* เงินในบัญชีธุรกิจ */}
          <Link 
            href="/accounts"
            prefetch={false}
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Building2 size={22} />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">บัญชีธุรกิจ</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {formatCurrency(data.businessTotal)}
            </p>
            {data.businessAccounts.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.businessAccounts.slice(0, 3).map((acc, i) => (
                  <p key={i} className="text-xs text-slate-500">
                    {acc.personName}: {formatCurrency(acc.balance)}
                  </p>
                ))}
              </div>
            )}
          </Link>

          {/* เงินสดธุรกิจ */}
          <Link 
            href="/accounts"
            prefetch={false}
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                <Wallet size={22} />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">เงินสดธุรกิจ</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {formatCurrency(data.businessCashTotal)}
            </p>
          </Link>

          {/* เงินส่วนตัวแยกตามบุคคล */}
          {data.personalByPerson.map((person) => (
            <Link 
              key={person.personId}
              href="/accounts"
              prefetch={false}
              className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                  <PiggyBank size={22} />
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-500">เงินอยู่กับ{person.personName}</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                {formatCurrency(person.balance)}
              </p>
            </Link>
          ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold text-slate-900">ลัดเพียงการทำงาน</h2>
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
            RECENT TRANSACTIONS — รายการล่าสุด
            ======================================== */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">รายการล่าสุด</h2>
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
              <p className="text-sm text-slate-500">ยังไม่มีรายการรายรับหรือรายจ่าย</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.recentTransactions.map((tx) => (
                <article key={tx.id} className="surface-card flex items-start gap-3 overflow-hidden p-4">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {tx.type === 'income' ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">{tx.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {tx.type === 'income' ? 'รายรับ' : 'รายจ่าย'} · {new Date(tx.date).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                      <p className={`shrink-0 font-bold ${tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                    {tx.sourceAccountName && (
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {tx.sourceAccountName}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <MobileNav />
    </main>
  );
}
