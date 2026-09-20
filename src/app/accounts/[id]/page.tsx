'use client';

import { ArrowLeft, ArrowDownLeft, ArrowUpRight, CircleDollarSign, Search, SlidersHorizontal, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { formatAccountDisplayName, formatCurrency, formatDateRange, formatDate } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { isUserAdmin, type Session } from '@/types/session';

type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
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
  sourceAccountNumber: string | null;
  sourceAccountType: 'bank' | 'cash' | null;
  sourceAccountAlias: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  destinationAccountBank: string | null;
  destinationAccountNumber: string | null;
  destinationAccountType: 'bank' | 'cash' | null;
  destinationAccountAlias: string | null;
  note: string | null;
  adjustmentReason: string | null;
  adjustmentDirection: 'increase' | 'decrease' | null;
  createdByUserName: string | null;
  createdAt: string;
};

type SortOrder = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'date_desc', label: 'ล่าสุดก่อน' },
  { value: 'date_asc', label: 'เก่าสุดก่อน' },
  { value: 'amount_desc', label: 'มาก→น้อย' },
  { value: 'amount_asc', label: 'น้อย→มาก' },
];
const SORT_PREFERENCE_KEY = 'transactionSortOrder';

// Date filter types - matching Transactions page
type DateFilterOption = 'today' | '7days' | '30days' | 'month' | 'custom' | 'all';

const dateFilterLabels: Record<DateFilterOption, string> = {
  today: 'วันนี้',
  '7days': '7 วัน',
  '30days': '30 วัน',
  month: 'เดือนนี้',
  custom: 'กำหนดเอง',
  all: 'ทั้งหมด',
};

// Date range calculation - matching Transactions page logic
const getDateRange = (filter: DateFilterOption, customFrom?: string, customTo?: string): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'today':
      // Same day
      break;
    case '7days':
      start.setDate(start.getDate() - 6);
      break;
    case '30days':
      start.setDate(start.getDate() - 29);
      break;
    case 'month':
      start.setDate(1);
      break;
    case 'custom':
      if (customFrom) {
        start.setTime(new Date(customFrom).getTime());
        start.setHours(0, 0, 0, 0);
      }
      if (customTo) {
        end.setTime(new Date(customTo).getTime());
        end.setHours(23, 59, 59, 999);
      }
      break;
    case 'all':
      start.setFullYear(2000, 0, 1); // Far past
      break;
  }

  return { start, end };
};

// Search normalization helper for account numbers and numeric data
const normalizeSearchText = (str: string): string => {
  return str.replace(/[-\s]/g, '').toLowerCase();
};

// Check if there are any transactions in the date range (for showing search section)
const hasTransactionsInRange = (
  transactions: Transaction[],
  accountId: string,
  dateRange: { start: Date; end: Date }
): boolean => {
  return transactions.some(tx => {
    const txDate = new Date(tx.date);
    const isForThisAccount =
      tx.sourceAccountId === accountId ||
      tx.destinationAccountId === accountId;
    const isInPeriod = txDate >= dateRange.start && txDate < dateRange.end;
    return isForThisAccount && isInPeriod && tx.status === 'completed';
  });
};

// Sort transactions helper
const sortTransactions = <T extends { date: string; amount: number; createdAt?: string }>(
  transactions: T[],
  sortOrder: SortOrder
): T[] => {
  return [...transactions].sort((a, b) => {
    if (sortOrder === 'amount_desc') {
      return b.amount - a.amount;
    }
    if (sortOrder === 'amount_asc') {
      return a.amount - b.amount;
    }
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateB !== dateA) {
      return sortOrder === 'date_desc' ? dateB - dateA : dateA - dateB;
    }
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return sortOrder === 'date_desc' ? createdB - createdA : createdA - createdB;
  });
};

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
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterOption>('month');
  const [customDateFrom, setCustomDateFrom] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customDateTo, setCustomDateTo] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Sort order state with localStorage persistence
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SORT_PREFERENCE_KEY);
      if (saved && SORT_OPTIONS.some(o => o.value === saved)) {
        return saved as SortOrder;
      }
    }
    return 'date_desc';
  });

  // Handle sort order change
  const handleSortOrderChange = (newOrder: SortOrder) => {
    setSortOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SORT_PREFERENCE_KEY, newOrder);
    }
  };

  // Session & role check
  const { data } = useSession();
  const session = data as Session | null;
  const isAdmin = isUserAdmin(session);

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
        const accountsJson = await accountsRes.json() as Account[];
        const transactionsJson = await transactionsRes.json() as Transaction[];
        setAccounts(accountsJson);
        setTransactions(transactionsJson);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Check if user can create adjustment (admin only)
  const canCreateAdjustment = isAdmin;

  // Create adjustment handler
  const handleCreateAdjustment = async (actualBalance: number, reason: string) => {
    if (!account) return;

    const currentBalance = account.currentBalance;
    const difference = actualBalance - currentBalance;

    if (difference === 0) {
      alert('ยอดที่กรอกเท่ากับยอดปัจจุบัน ไม่ต้องปรับยอด');
      return;
    }

    const isIncrease = difference > 0;
    const isDecrease = difference < 0;

    setIsAdjusting(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'adjustment',
          amount: Math.abs(difference),
          title: `ปรับยอด: ${isIncrease ? 'เพิ่ม' : 'ลด'} ${formatCurrency(Math.abs(difference))}`,
          date: new Date().toISOString(),
          sourceAccountId: account.id,
          destinationAccountId: null,
          categoryId: null,
          businessStatus: null,
          adjustmentReason: reason,
          adjustmentDirection: isIncrease ? 'increase' : 'decrease',
          note: `ปรับยอดจาก ${formatCurrency(currentBalance)} เป็น ${formatCurrency(actualBalance)}`,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { error?: string | Record<string, string[]>; message?: string };
        // Server returns { error: ... } not { message: ... }
        let errorMsg = errorData.message;
        if (!errorMsg && errorData.error) {
          if (typeof errorData.error === 'string') {
            errorMsg = errorData.error;
          } else {
            // Zod validation error shape: { field: [msgs] }
            const fieldErrors = errorData.error as Record<string, string[]>;
            const firstField = Object.keys(fieldErrors)[0];
            if (firstField) errorMsg = fieldErrors[firstField]?.[0];
          }
        }
        throw new Error(errorMsg || 'ไม่สามารถปรับยอดได้');
      }
      
      // Reload data
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/transactions'),
      ]);
      if (accountsRes.ok) setAccounts(await accountsRes.json());
      if (transactionsRes.ok) setTransactions(await transactionsRes.json());
      
      setIsAdjustmentModalOpen(false);
      alert('ปรับยอดเรียบร้อยแล้ว');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Get date range for selected filter - using shared logic
  const dateRange = useMemo(() => {
    return getDateRange(selectedDateFilter, customDateFrom, customDateTo);
  }, [selectedDateFilter, customDateFrom, customDateTo]);

  // Check if there are any transactions in range (for showing search section)
  const hasTransactionsInRangeForAccount = useMemo(() => {
    return hasTransactionsInRange(transactions, accountId, dateRange);
  }, [transactions, accountId, dateRange]);

  // Filter and calculate transactions for this account
  const { summary, filteredTransactions, incomeCount, expenseCount } = useMemo(() => {
    if (!account) return { summary: { income: 0, expense: 0, net: 0, adjustment: 0 }, filteredTransactions: [], incomeCount: 0, expenseCount: 0 };

    const { start, end } = dateRange;

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

    // Calculate summary (exclude adjustments - they affect balance but not income/expense)
    let income = 0;
    let expense = 0;
    let adjustmentTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const tx of accountTransactions) {
      if (tx.type === 'income') {
        income += tx.amount;
        incomeCount++;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
        expenseCount++;
      } else if (tx.type === 'transfer') {
        if (tx.sourceAccountId === accountId) {
          expense += tx.amount; // โอนออก = รายจ่าย
          expenseCount++;
        } else if (tx.destinationAccountId === accountId) {
          income += tx.amount; // โอนเข้า = รายรับ
          incomeCount++;
        }
      } else if (tx.type === 'adjustment') {
        // ปรับยอด: แยกแสดงไม่นับในรายรับ/รายจ่าย
        adjustmentTotal += tx.amount;
      }
    }

    // Apply summary filter (from card interaction)
    let filteredByType = accountTransactions;
    if (summaryFilter === 'income') {
      filteredByType = accountTransactions.filter(tx =>
        tx.type === 'income' || (tx.type === 'transfer' && tx.destinationAccountId === accountId)
      );
    } else if (summaryFilter === 'expense') {
      filteredByType = accountTransactions.filter(tx =>
        tx.type === 'expense' || (tx.type === 'transfer' && tx.sourceAccountId === accountId)
      );
    }

    // Search filter with normalization for account numbers
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedSearchDigits = normalizeSearchText(searchQuery);

    const filtered = normalizedSearch === ''
      ? filteredByType
      : filteredByType.filter(tx => {
          // Text search
          const textMatch =
            tx.title.toLowerCase().includes(normalizedSearch) ||
            (tx.note?.toLowerCase().includes(normalizedSearch) ?? false) ||
            (tx.categoryName?.toLowerCase().includes(normalizedSearch) ?? false);

          // Numeric search with normalization
          let numericMatch = false;
          if (normalizedSearchDigits.length > 0) {
            const txAmount = Math.abs(tx.amount).toString();
            const txAmountDigits = normalizeSearchText(txAmount);

            // Check if search digits match any part of the amount
            numericMatch =
              txAmountDigits.includes(normalizedSearchDigits) ||
              normalizedSearchDigits.includes(txAmountDigits.split('.')[0]) ||
              txAmountDigits.split('.')[0].startsWith(normalizedSearchDigits.split('.')[0]);
          }

          return textMatch || numericMatch;
        });

    // Sort using shared sortTransactions helper
    const sorted = sortTransactions(filtered, sortOrder);

    return {
      summary: { income, expense, net: income - expense, adjustment: adjustmentTotal },
      filteredTransactions: sorted,
      incomeCount,
      expenseCount,
    };
  }, [account, accountId, transactions, selectedDateFilter, customDateFrom, customDateTo, searchQuery, sortOrder, summaryFilter]);

  // Transaction display helper
  const getTransactionDisplay = (tx: Transaction) => {
    if (tx.type === 'adjustment') {
      // ปรับยอด: ดูจาก adjustmentDirection ที่เก็บในฐานข้อมูล
      const isIncrease = tx.adjustmentDirection === 'increase';
      return {
        direction: isIncrease ? 'in' as const : 'out' as const,
        icon: isIncrease ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />,
        iconBg: 'bg-orange-50 text-orange-700',
        amountColor: isIncrease ? 'text-orange-700' : 'text-orange-700',
        amountPrefix: isIncrease ? '+' : '-',
        accountLabel: 'ปรับยอดบัญชี',
      };
    }
    if (tx.type === 'transfer') {
      if (tx.sourceAccountId === accountId) {
        // Transfer Out: บัญชีนี้ → บัญชีปลายทาง
        const destLabel = tx.destinationAccountId
          ? formatAccountDisplayName({
              accountType: tx.destinationAccountType ?? 'bank',
              accountAlias: tx.destinationAccountAlias,
              bankName: tx.destinationAccountBank,
              accountNumber: tx.destinationAccountNumber,
            })
          : 'บัญชีอื่น';
        const selfLabel = account
          ? formatAccountDisplayName({
              accountType: account.accountType,
              accountAlias: account.accountAlias,
              bankName: account.bankName,
              accountNumber: account.accountNumber,
            })
          : 'บัญชีนี้';
        return {
          direction: 'out' as const,
          icon: <ArrowUpRight size={18} />,
          iconBg: 'bg-indigo-50 text-indigo-700',
          amountColor: 'text-indigo-700',
          amountPrefix: '-',
          accountLabel: `${selfLabel} → ${destLabel}`,
        };
      } else {
        // Transfer In: บัญชีต้นทาง → บัญชีนี้
        const selfLabel = account
          ? formatAccountDisplayName({
              accountType: account.accountType,
              accountAlias: account.accountAlias,
              bankName: account.bankName,
              accountNumber: account.accountNumber,
            })
          : 'บัญชีนี้';
        const srcLabel = tx.sourceAccountId
          ? formatAccountDisplayName({
              accountType: tx.sourceAccountType ?? 'bank',
              accountAlias: tx.sourceAccountAlias,
              bankName: tx.sourceAccountBank,
              accountNumber: tx.sourceAccountNumber,
            })
          : 'บัญชีอื่น';
        return {
          direction: 'in' as const,
          icon: <ArrowDownLeft size={18} />,
          iconBg: 'bg-indigo-50 text-indigo-700',
          amountColor: 'text-indigo-700',
          amountPrefix: '+',
          accountLabel: `${srcLabel} → ${selfLabel}`,
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
                {account
                  ? formatAccountDisplayName({
                      accountType: account.accountType,
                      accountAlias: account.accountAlias,
                      bankName: account.bankName,
                      accountNumber: account.accountNumber,
                    })
                  : 'กำลังโหลด...'}
              </h1>
            </div>
          </div>
          {canCreateAdjustment && account && (
            <button
              type="button"
              onClick={() => setIsAdjustmentModalOpen(true)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              ปรับยอด
            </button>
          )}
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
            {account.accountNumber && (
              <p className="mt-2 text-sm text-emerald-200">เลขบัญชี {account.accountNumber}</p>
            )}
          </div>
        )}

        {/* Date Filter Pills - matching Transactions page */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.keys(dateFilterLabels) as DateFilterOption[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelectedDateFilter(option)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedDateFilter === option
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dateFilterLabels[option]}
            </button>
          ))}
        </div>

        {/* Date Range Display - Match Transactions Page style */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <span className="text-base">📅</span>
            {formatDateRange(dateRange.start, dateRange.end)}
          </span>
        </div>

        {/* Custom Date Range - Show when 'custom' is selected */}
        {selectedDateFilter === 'custom' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <span className="flex items-center text-slate-400">-</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Summary Cards - Row 1: Income & Expense */}
        <div className="grid grid-cols-2 gap-3">
          {/* Income Card */}
          <button
            type="button"
            onClick={() => setSummaryFilter(summaryFilter === 'income' ? 'all' : 'income')}
            className={`surface-card p-4 text-left transition-all ${
              summaryFilter === 'income' ? 'ring-2 ring-emerald-500' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <ArrowDownLeft size={16} />
              </div>
              <p className="text-sm text-slate-500">รายรับ</p>
            </div>
            <p className="mt-2 text-xl font-bold text-emerald-700">
              {formatCurrency(summary.income)}
            </p>
            <p className="mt-1 text-xs text-slate-400">{incomeCount} รายการ</p>
          </button>

          {/* Expense Card */}
          <button
            type="button"
            onClick={() => setSummaryFilter(summaryFilter === 'expense' ? 'all' : 'expense')}
            className={`surface-card p-4 text-left transition-all ${
              summaryFilter === 'expense' ? 'ring-2 ring-rose-500' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
                <ArrowUpRight size={16} />
              </div>
              <p className="text-sm text-slate-500">รายจ่าย</p>
            </div>
            <p className="mt-2 text-xl font-bold text-rose-700">
              {formatCurrency(summary.expense)}
            </p>
            <p className="mt-1 text-xs text-slate-400">{expenseCount} รายการ</p>
          </button>
        </div>

        {/* Summary Cards - Row 2: Filter Chips + Net (Full Width) */}
        <div className="space-y-3">
          {/* Filter Chips - แสดงเมื่อมี transaction ในช่วง */}
          {hasTransactionsInRangeForAccount && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSummaryFilter('all')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  summaryFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setSummaryFilter('income')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  summaryFilter === 'income'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                รายรับ
              </button>
              <button
                type="button"
                onClick={() => setSummaryFilter('expense')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  summaryFilter === 'expense'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                รายจ่าย
              </button>
            </div>
          )}

          {/* Net Card - Full Width Summary */}
          <div className="surface-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <CircleDollarSign size={16} />
                </div>
                <p className="text-sm text-slate-500">สุทธิ</p>
              </div>
              <p className={`text-xl font-bold ${summary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net)}
              </p>
            </div>
          </div>
        </div>

        {/* Adjustment Summary - Only show if there are adjustments */}
        {summary.adjustment !== 0 && (
          <div className="surface-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-50 text-orange-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-xs text-slate-500">ปรับยอดบัญชี</p>
              </div>
              <p className={`text-sm font-bold ${summary.adjustment >= 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                {summary.adjustment >= 0 ? '+' : ''}{formatCurrency(summary.adjustment)}
              </p>
            </div>
          </div>
        )}

        {/* Search & Sort Row - Show when there are transactions in range */}
        {hasTransactionsInRangeForAccount && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ค้นหารายการ..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={sortOrder}
              onChange={(e) => handleSortOrderChange(e.target.value as SortOrder)}
              className="h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Result Count - Show when there are transactions in range */}
        {hasTransactionsInRangeForAccount && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {summaryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                กำลังแสดง: {summaryFilter === 'income' ? 'รายรับ' : 'รายจ่าย'}
                <button
                  type="button"
                  onClick={() => setSummaryFilter('all')}
                  className="ml-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <span>{filteredTransactions.length} รายการ</span>
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
                            {formatDate(tx.date)}
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

      {/* Adjustment Modal */}
      {isAdjustmentModalOpen && account && (
        <AdjustmentModal
          account={account}
          onClose={() => setIsAdjustmentModalOpen(false)}
          onSubmit={handleCreateAdjustment}
          isLoading={isAdjusting}
        />
      )}

      <MobileNav />
    </main>
  );
}

// Adjustment Modal Component
function AdjustmentModal({
  account,
  onClose,
  onSubmit,
  isLoading,
}: {
  account: Account;
  onClose: () => void;
  onSubmit: (actualBalance: number, reason: string) => Promise<void>;
  isLoading: boolean;
}) {
  const [actualBalance, setActualBalance] = useState('');
  const [reason, setReason] = useState('');

  const difference = account.currentBalance - (parseFloat(actualBalance) || 0);
  const isIncrease = difference < 0;
  const hasChange = parseFloat(actualBalance) !== account.currentBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('กรุณาระบุเหตุผลการปรับยอด');
      return;
    }
    onSubmit(parseFloat(actualBalance), reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center">
      <div className="surface-card w-full max-w-md rounded-t-3xl p-6 md:rounded-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">ปรับยอดบัญชี</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Balance Display */}
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">ยอดปัจจุบันในระบบ</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(account.currentBalance)}
            </p>
          </div>

          {/* New Balance Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ยอดจริงในบัญชี
            </label>
            <input
              type="number"
              step="0.01"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              placeholder="กรอกยอดจริง"
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-lg outline-none focus:border-emerald-600"
              autoFocus
            />
          </div>

          {/* Difference Preview */}
          {hasChange && (
            <div className={`rounded-xl p-4 ${isIncrease ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <p className={`text-sm ${isIncrease ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isIncrease ? '📈 จะเพิ่มยอด' : '📉 จะลดยอด'}
              </p>
              <p className={`mt-1 text-xl font-bold ${isIncrease ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isIncrease ? '+' : '-'}{formatCurrency(Math.abs(difference))}
              </p>
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              เหตุผลการปรับยอด <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น กรอกยอดเริ่มต้นผิด, ปรับยอด ATM ที่อยู่ในบัญชี"
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !hasChange || !reason.trim()}
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? 'กำลังปรับยอด...' : 'บันทึกการปรับยอด'}
          </button>
        </form>
      </div>
    </div>
  );
}
