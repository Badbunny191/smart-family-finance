'use client';

import { ArrowLeft, ArrowDownLeft, ArrowUpRight, CircleDollarSign, Search } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { formatCurrency } from '@/lib/utils';

type TransactionType = 'income' | 'expense' | 'transfer';
type BusinessStatus = 'pending' | 'received';
type Account = {
  id: string;
  name: string;
  accountAlias: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountType: 'bank' | 'cash';
  isBusinessAccount: boolean;
  currentBalance: number;
};
type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  businessStatus: BusinessStatus | null;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  sourceAccountBank: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  destinationAccountBank: string | null;
};

type Period = 'today' | 'week' | 'month';

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  return (
    <Suspense fallback={<AccountDetailLoading />}>
      <AccountDetailContent accountId={accountId} />
    </Suspense>
  );
}

function AccountDetailLoading() {
  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-5 pb-5 pt-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </header>
      <section className="px-5 py-5">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      </section>
      <MobileNav />
    </main>
  );
}

function AccountDetailContent({ accountId }: { accountId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Find current account
  const account = accounts.find(a => a.id === accountId);
  const isAccountNotFound = !isLoading && accounts.length > 0 && !account;

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [accountsRes, transactionsRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/transactions'),
        ]);
        if (!accountsRes.ok || !transactionsRes.ok) {
          throw new Error('โหลดข้อมูลไม่สำเร็จ');
        }
        setAccounts(await accountsRes.json());
        setTransactions(await transactionsRes.json());
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Get date range for selected period
  const getDateRange = (period: Period): { start: Date; end: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'week': {
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return { start: startOfWeek, end: endOfWeek };
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      }
    }
  };

  // Filter and calculate transactions for this account
  const { summary, filteredTransactions } = useMemo(() => {
    if (!account) return { summary: { income: 0, expense: 0, net: 0 }, filteredTransactions: [] };

    const { start, end } = getDateRange(selectedPeriod);

    // Filter transactions for this account
    // Logic: completed=shown, cancelled=hidden, pending=hidden
    const accountTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const isForThisAccount = 
        tx.sourceAccountId === accountId || 
        tx.destinationAccountId === accountId;
      const isInPeriod = txDate >= start && txDate < end;
      
      // Status filter: completed=shown, cancelled=hidden, pending=hidden
      const isCompleted = tx.status === 'completed';
      
      return isForThisAccount && isInPeriod && isCompleted;
    });

    // Calculate summary
    let income = 0;
    let expense = 0;

    for (const tx of accountTransactions) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.sourceAccountId === accountId) {
          expense += tx.amount; // โอนออก = รายจ่าย
        } else if (tx.destinationAccountId === accountId) {
          income += tx.amount; // โอนเข้า = รายรับ
        }
      }
    }

    // Search filter
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = normalizedSearch === ''
      ? accountTransactions
      : accountTransactions.filter(tx => 
          tx.title.toLowerCase().includes(normalizedSearch)
        );

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      summary: { income, expense, net: income - expense },
      filteredTransactions: filtered,
    };
  }, [account, accountId, transactions, selectedPeriod, searchQuery]);

  // Transaction display helper
  const getTransactionDisplay = (tx: Transaction) => {
    if (tx.type === 'transfer') {
      if (tx.sourceAccountId === accountId) {
        // Transfer Out: บัญชีนี้ → บัญชีปลายทาง
        return {
          direction: 'out' as const,
          icon: <ArrowUpRight size={18} />,
          iconBg: 'bg-indigo-50 text-indigo-700',
          amountColor: 'text-indigo-700',
          amountPrefix: '-',
          accountLabel: tx.destinationAccountName 
            ? `${account?.name || 'บัญชีนี้'} → ${tx.destinationAccountName}`
            : `${account?.name || 'บัญชีนี้'} → บัญชีอื่น`,
        };
      } else {
        // Transfer In: บัญชีต้นทาง → บัญชีนี้
        return {
          direction: 'in' as const,
          icon: <ArrowDownLeft size={18} />,
          iconBg: 'bg-indigo-50 text-indigo-700',
          amountColor: 'text-indigo-700',
          amountPrefix: '+',
          accountLabel: tx.sourceAccountName 
            ? `${tx.sourceAccountName} → ${account?.name || 'บัญชีนี้'}`
            : `บัญชีอื่น → ${account?.name || 'บัญชีนี้'}`,
        };
      }
    } else if (tx.type === 'income') {
      return {
        direction: 'in' as const,
        icon: <ArrowDownLeft size={18} />,
        iconBg: 'bg-emerald-50 text-emerald-700',
        amountColor: 'text-emerald-700',
        amountPrefix: '+',
        accountLabel: 'เงินเข้าบัญชี',
      };
    } else {
      return {
        direction: 'out' as const,
        icon: <ArrowUpRight size={18} />,
        iconBg: 'bg-rose-50 text-rose-700',
        amountColor: 'text-rose-700',
        amountPrefix: '-',
        accountLabel: 'เงินออกจากบัญชี',
      };
    }
  };

  // Account not found state
  if (isAccountNotFound) {
    return (
      <main className="app-shell min-h-screen pb-24 md:pb-0">
        <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/accounts" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <p className="text-sm text-slate-500">ไม่พบบัญชี</p>
              </div>
            </div>
          </div>
        </header>
        <section className="space-y-4 px-5 py-5">
          <div className="surface-card border-dashed px-5 py-12 text-center">
            <CircleDollarSign className="mx-auto text-slate-400" size={30} />
            <p className="mt-3 font-medium text-slate-700">ไม่พบบัญชีที่ต้องการ</p>
            <p className="mt-1 text-sm text-slate-500">บัญชีอาจถูกลบหรือไม่มีอยู่ในระบบ</p>
          </div>
          <Link 
            href="/accounts" 
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700"
          >
            <ArrowLeft size={18} />
            กลับไปหน้าบัญชี
          </Link>
        </section>
        <MobileNav />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="app-shell min-h-screen pb-24 md:pb-0">
        <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/accounts" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <p className="text-sm text-slate-500">เกิดข้อผิดพลาด</p>
              </div>
            </div>
          </div>
        </header>
        <section className="px-5 py-5">
          <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>
        </section>
        <MobileNav />
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-5 pb-5 pt-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/accounts" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-sm text-slate-500">
                {account?.isBusinessAccount ? '🏢 บัญชีธุรกิจ' : '👤 บัญชีส่วนตัว'}
              </p>
              <h1 className="text-lg font-bold text-slate-900">
                {account?.accountAlias || account?.name || 'กำลังโหลด...'}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4 px-5 py-5">
        {/* Balance Card */}
        {account && (
          <div className="surface-card overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 p-5 text-white">
            <p className="text-sm font-medium text-emerald-100">ยอดคงเหลือ</p>
            <p className="mt-2 text-[2rem] font-bold tracking-tight">
              {formatCurrency(account.currentBalance)}
            </p>
            {account.bankName && (
              <p className="mt-2 text-sm text-emerald-200">{account.bankName}</p>
            )}
          </div>
        )}

        {/* Period Filter */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedPeriod('today')}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all ${
              selectedPeriod === 'today'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod('week')}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all ${
              selectedPeriod === 'week'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            สัปดาห์นี้
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod('month')}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all ${
              selectedPeriod === 'month'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            เดือนนี้
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="surface-card p-4 text-center">
            <p className="text-xs text-slate-500">รายรับ</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              +{formatCurrency(summary.income)}
            </p>
          </div>
          <div className="surface-card p-4 text-center">
            <p className="text-xs text-slate-500">รายจ่าย</p>
            <p className="mt-1 text-lg font-bold text-rose-700">
              -{formatCurrency(summary.expense)}
            </p>
          </div>
          <div className="surface-card p-4 text-center">
            <p className="text-xs text-slate-500">สุทธิ</p>
            <p className={`mt-1 text-lg font-bold ${summary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net)}
            </p>
          </div>
        </div>

        {/* Search */}
        {filteredTransactions.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="🔍 ค้นหารายการ..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-600"
            />
          </div>
        )}

        {/* Transaction List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="surface-card border-dashed px-5 py-12 text-center">
            <CircleDollarSign className="mx-auto text-slate-400" size={30} />
            <p className="mt-3 font-medium text-slate-700">ยังไม่มีรายการเคลื่อนไหว</p>
            <p className="mt-1 text-sm text-slate-500">ในช่วงเวลาที่เลือก</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => {
              const display = getTransactionDisplay(tx);
              return (
                <article key={tx.id} className="surface-card overflow-hidden p-4">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${display.iconBg}`}>
                      {display.icon}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-900">{tx.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(tx.date).toLocaleDateString('th-TH')}
                          </p>
                          {display.accountLabel && (
                            <p className="mt-1 truncate text-xs text-slate-400">
                              {display.accountLabel}
                            </p>
                          )}
                        </div>
                        <p className={`shrink-0 text-xl font-bold tracking-tight ${display.amountColor}`}>
                          {display.amountPrefix}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <MobileNav />
    </main>
  );
}
