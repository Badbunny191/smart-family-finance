import { AlertTriangle, Building2, CircleDollarSign, PiggyBank, Wallet } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';
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

  // 1. รอชำระ (pending income)
  const pendingResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.type, 'income'),
      eq(transactions.businessStatus, 'pending'),
      isNull(transactions.deletedAt)
    ));

  // 2. บัญชีธุรกิจ
  const businessAccounts = await db
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
    ));

  // 3. เงินสดธุรกิจ
  const businessCashResult = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
    })
    .from(accounts)
    .where(and(
      eq(accounts.isBusinessAccount, true),
      eq(accounts.accountType, 'cash'),
      isNull(accounts.deletedAt)
    ));

  // 4. เงินส่วนตัวแยกตามบุคคล
  const personalByPerson = await db
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
    .groupBy(persons.id, persons.name);

  const data = {
    pending: { 
      total: Number(pendingResult[0]?.total) || 0, 
      count: Number(pendingResult[0]?.count) || 0 
    },
    businessAccounts: businessAccounts as { personId: string; personName: string; balance: number; accountName: string }[],
    businessCashTotal: Number(businessCashResult[0]?.balance) || 0,
    personalByPerson: personalByPerson as { personId: string; personName: string; balance: number }[],
  };

  const businessTotal = data.businessAccounts.reduce((sum, acc) => sum + acc.balance, 0);

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
        {/* Action Center Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {/* รอชำระ */}
          <Link 
            href="/transactions?type=income&businessStatus=pending"
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
            className="surface-card block overflow-hidden p-4 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Building2 size={22} />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">บัญชีธุรกิจ</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {formatCurrency(businessTotal)}
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

        {/* Quick Links */}
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold text-slate-900">ลัดเพียงการทำงาน</h2>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/transactions?type=income" className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CircleDollarSign size={20} />
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">รายรับใหม่</p>
            </Link>
            <Link href="/transactions?type=expense" className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">รายจ่ายใหม่</p>
            </Link>
            <Link href="/transactions?type=transfer" className="surface-card block p-4 text-center transition-transform active:scale-[0.98]">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">โอนเงิน</p>
            </Link>
          </div>
        </section>
      </div>
      <MobileNav />
    </main>
  );
}
