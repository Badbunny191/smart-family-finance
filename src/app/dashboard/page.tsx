import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Building2, CircleDollarSign, WalletCards } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { getDb } from '@/db/client';
import { createAuth } from '@/lib/auth';
import { getD1 } from '@/lib/cloudflare';
import { getDashboardData } from '@/lib/dashboard-data';
import { formatCurrency } from '@/lib/utils';

export const runtime = 'nodejs';

const typeLabels = { income: 'รายรับ', expense: 'รายจ่าย', transfer: 'โอนเงิน' } as const;

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const d1 = await getD1();
  const session = await createAuth(d1).api.getSession({ headers: requestHeaders });
  if (!session) redirect('/login');
  const data = await getDashboardData(getDb(d1));

  return (
    <main className="app-shell min-h-screen pb-24">
      <header className="border-b border-slate-200/70 bg-white px-5 pb-6 pt-7">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div><p className="section-label">ภาพรวมการเงินครอบครัว</p><h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">สวัสดี, {session.user.name}</h1><p className="mt-1 text-sm text-slate-500">{session.user.email}</p></div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-6">
        <section>
          <div className="surface-card overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 p-5 text-white"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-emerald-100">สินทรัพย์รวมทั้งหมด</p><p className="mt-2 text-[2rem] font-bold tracking-tight">{formatCurrency(data.summary.totalAssets)}</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><CircleDollarSign size={22} /></div></div><div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-sm"><span className="text-emerald-100">เงินสดรวม</span><strong>{formatCurrency(data.summary.totalCash)}</strong></div></div>
          <div className="mb-3 mt-7 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">สรุปเดือนนี้</h2><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Session active</span></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="เงินสดรวม" value={data.summary.totalCash} icon={<WalletCards size={20} />} tone="sky" />
            <SummaryCard label="รายรับเดือนนี้" value={data.summary.monthlyIncome} icon={<ArrowDownLeft size={20} />} tone="emerald" />
            <SummaryCard label="รายจ่ายเดือนนี้" value={data.summary.monthlyExpense} icon={<ArrowUpRight size={20} />} tone="rose" />
            <SummaryCard label="เงินรอโอนเข้าธุรกิจ" value={data.summary.pendingBusinessTransfer} icon={<ArrowLeftRight size={20} />} tone="sky" />
            <div className="col-span-2 lg:col-span-4"><SummaryCard label="คงเหลือสุทธิเดือนนี้" value={data.summary.netBalance} icon={<CircleDollarSign size={20} />} tone={data.summary.netBalance >= 0 ? 'emerald' : 'rose'} /></div>
          </div>
        </section>

        <section>
          <SectionHeading title="รายการล่าสุด" href="/transactions" />
          {data.recentTransactions.length === 0 ? <EmptyState title="ยังไม่มีรายการเงิน" description="เริ่มต้นด้วยการเพิ่มรายรับหรือรายจ่าย" href="/transactions" action="เพิ่มรายการ" /> : <div className="grid gap-3 lg:grid-cols-2">{data.recentTransactions.map((transaction) => <article key={transaction.id} className="surface-card p-4"><div className="flex items-start gap-3"><div className={`grid min-h-10 min-w-10 place-items-center rounded-2xl ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-700' : transaction.type === 'expense' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>{transaction.type === 'income' ? <ArrowDownLeft size={19} /> : transaction.type === 'expense' ? <ArrowUpRight size={19} /> : <ArrowLeftRight size={19} />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="truncate font-semibold text-slate-900">{transaction.title}</h3><p className="mt-1 text-xs text-slate-500">{typeLabels[transaction.type]} · {new Date(transaction.date).toLocaleDateString('th-TH')}</p></div><p className={`shrink-0 font-bold ${transaction.type === 'expense' ? 'text-rose-700' : transaction.type === 'transfer' ? 'text-indigo-700' : 'text-emerald-700'}`}>{transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}</p></div><p className="mt-2 text-xs text-slate-500">{transaction.type === 'transfer' ? `${transaction.sourceAccountName || '-'} → ${transaction.destinationAccountName || '-'}` : transaction.sourceAccountName || transaction.destinationAccountName || 'ไม่ระบุบัญชี'}</p></div></div></article>)}</div>}
        </section>

        <section>
          <SectionHeading title="บัญชีทั้งหมด" href="/accounts" />
          {data.accountSummary.length === 0 ? <EmptyState title="ยังไม่มีบัญชี" description="เพิ่มบัญชีเพื่อเริ่มติดตามยอดคงเหลือ" href="/accounts" action="เพิ่มบัญชี" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.accountSummary.map((account) => <article key={account.id} className="surface-card p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{account.name}</h3><p className="mt-1 text-xs text-slate-500">{account.accountType === 'cash' ? 'เงินสด' : 'ธนาคาร'}</p></div><WalletCards className="text-emerald-600" size={21} /></div><p className="mt-4 text-xl font-bold tracking-tight text-slate-900">{formatCurrency(account.currentBalance)}</p></article>)}</div>}
        </section>

        <section>
          <SectionHeading title={`ทรัพย์สิน (${data.propertySummary.length})`} href="/properties" />
          {data.propertySummary.length === 0 ? <EmptyState title="ยังไม่มีทรัพย์สิน" description="เพิ่มทรัพย์สินเพื่อจัดกลุ่มการเงินของครอบครัว" href="/properties" action="เพิ่มทรัพย์สิน" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.propertySummary.map((property) => <article key={property.id} className="surface-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{property.name}</h3><p className="mt-1 text-sm text-slate-500">เจ้าของ: {property.ownerName}</p></div><Building2 className="text-indigo-600" size={21} /></div><span className={`mt-4 inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold ${property.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{property.status === 'active' ? 'ใช้งานอยู่' : 'ไม่ใช้งาน'}</span></article>)}</div>}
        </section>
      </div>
      <MobileNav />
    </main>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: 'emerald' | 'sky' | 'rose' }) {
  const toneClass = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', rose: 'bg-rose-50 text-rose-700' }[tone];
  return <article className="surface-card p-4"><div className={`grid min-h-10 min-w-10 w-fit place-items-center rounded-2xl ${toneClass}`}>{icon}</div><p className="mt-3 text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-lg font-bold tracking-tight text-slate-900">{formatCurrency(value)}</p></article>;
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">{title}</h2><a href={href} className="touch-button flex items-center px-1 text-sm font-semibold text-emerald-700">ดูทั้งหมด</a></div>;
}

function EmptyState({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return <div className="surface-card border-dashed px-5 py-9 text-center"><p className="font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p><a href={href} className="touch-button mt-4 inline-flex items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">{action}</a></div>;
}