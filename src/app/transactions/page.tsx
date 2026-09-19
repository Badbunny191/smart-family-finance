'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ArrowRightLeft, CircleMinus, CirclePlus, Filter, Loader2, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';
import { formatAccountDisplayName, formatAccountForSelector } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { isUserAdmin, type Session } from '@/types/session';

type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
type BusinessStatus = 'pending' | 'received';
type Property = { id: string; name: string };

// Shared sort types
type SortOrder = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'date_desc', label: 'ล่าสุดก่อน' },
  { value: 'date_asc', label: 'เก่าสุดก่อน' },
  { value: 'amount_desc', label: 'มาก→น้อย' },
  { value: 'amount_asc', label: 'น้อย→มาก' },
];
const SORT_PREFERENCE_KEY = 'transactionSortOrder';

// Account display helper — delegates to shared formatter
const formatAccountLabel = (account: {
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  accountType: 'bank' | 'cash';
  isBusinessAccount: boolean;
  accountAlias?: string | null;
  personName?: string | null;
}) => {
  return formatAccountDisplayName({
    accountType: account.accountType,
    accountAlias: account.accountAlias,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    name: account.name,
    owner: account.personName,
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
    // Date sorting
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateB !== dateA) {
      return sortOrder === 'date_desc' ? dateB - dateA : dateA - dateB;
    }
    // Secondary sort by createdAt for same date
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return sortOrder === 'date_desc' ? createdB - createdA : createdA - createdB;
  });
};

type Account = { id: string; name: string; accountNumber: string | null; bankName: string | null; currentBalance: number; isBusinessAccount: boolean; accountType: 'bank' | 'cash'; personId: string; personName: string; accountAlias?: string | null };
type Category = { id: string; name: string; type: 'income' | 'expense'; isActive: boolean };
type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  title: string;
  status: string;
  propertyId: string | null;
  propertyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  businessStatus: BusinessStatus | null;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  sourceAccountAlias?: string | null;
  sourceAccountBank: string | null;
  sourceAccountNumber: string | null;
  sourceAccountType: 'bank' | 'cash' | null;
  sourceIsBusinessAccount: boolean | null;
  sourcePersonName?: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  destinationAccountAlias?: string | null;
  destinationAccountBank: string | null;
  destinationAccountNumber: string | null;
  destinationAccountType: 'bank' | 'cash' | null;
  destinationIsBusinessAccount: boolean | null;
  destinationPersonName?: string | null;
  note: string | null;
  adjustmentReason: string | null;
  createdAt?: string;
};
type FormState = {
  type: TransactionType;
  amount: string;
  date: string;
  title: string;
  propertyId: string;
  categoryId: string;
  businessStatus: '' | BusinessStatus;
  sourceAccountId: string;
  destinationAccountId: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm: FormState = {
  type: 'expense',
  amount: '',
  date: today(),
  title: '',
  propertyId: '',
  categoryId: '',
  businessStatus: '',
  sourceAccountId: '',
  destinationAccountId: '',
  note: '',
};

const businessStatusLabels: Record<BusinessStatus, string> = {
  pending: 'รอชำระ',
  received: 'รับชำระแล้ว',
};

// Date filter types
type DateFilterOption = 'today' | '7days' | '30days' | 'month' | 'custom' | 'all';

const dateFilterLabels: Record<DateFilterOption, string> = {
  today: 'วันนี้',
  '7days': '7 วัน',
  '30days': '30 วัน',
  month: 'เดือนนี้',
  custom: 'กำหนดเอง',
  all: 'ทั้งหมด',
};

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsLoading />}>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsLoading() {
  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-11 flex-1 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-20 animate-pulse rounded-full bg-slate-200" />
          ))}
        </div>
        <div className="mt-3 h-4 w-48 animate-pulse rounded bg-slate-200" />
      </header>
      <section className="space-y-3 px-4 py-4">
        <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
      </section>
      <MobileNav />
    </main>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  // Admin check for adjustment permissions
  const { data: sessionData } = useSession();
  const session = sessionData as Session | null;
  const isAdmin = isUserAdmin(session);

  // Initialize filters from URL params
  const urlType = searchParams.get('type');
  const urlBusinessStatus = searchParams.get('businessStatus');
  const urlAccount = searchParams.get('account');
  const validTypes: TransactionType[] = ['income', 'expense', 'transfer', 'adjustment'];
  const validStatuses: BusinessStatus[] = ['pending', 'received'];

  const [selectedType, setSelectedType] = useState<'all' | TransactionType>(
    urlType && validTypes.includes(urlType as TransactionType) ? urlType as TransactionType : 'all'
  );
  const [selectedBusinessStatus, setSelectedBusinessStatus] = useState<'all' | BusinessStatus>(
    urlBusinessStatus && validStatuses.includes(urlBusinessStatus as BusinessStatus) ? urlBusinessStatus as BusinessStatus : 'all'
  );
  const [selectedAccount, setSelectedAccount] = useState<string>(
    urlAccount || 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMarkingReceived, setIsMarkingReceived] = useState<string | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterOption>('month');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SORT_PREFERENCE_KEY);
      if (saved && SORT_OPTIONS.some(o => o.value === saved)) {
        return saved as SortOrder;
      }
    }
    return 'date_desc';
  });
  const { showToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_LIMIT = 50;

  // Date range calculation
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
        // Use custom dates if provided
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

  const { start: dateRangeStart, end: dateRangeEnd } = getDateRange(selectedDateFilter, customDateFrom, customDateTo);

  // Format date range for display
  const formatDateRange = (start: Date, end: Date): string => {
    const formatThai = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    
    // Check if same day
    if (start.toDateString() === end.toDateString()) {
      return formatThai(start);
    }
    
    return `${formatThai(start)} - ${formatThai(end)}`;
  };

  const loadData = async (isLoadMore = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setCurrentPage(1);
      // Clear records when filter changes (not load more)
      setTransactions([]);
    }

    try {
      // Build filter params for server-side filtering
      const filterParams = new URLSearchParams();
      filterParams.set('page', isLoadMore ? String(currentPage + 1) : '1');
      filterParams.set('limit', String(PAGE_LIMIT));

      // Add filter params only when not 'all'
      if (selectedType !== 'all') {
        filterParams.set('type', selectedType);
      }
      if (selectedBusinessStatus !== 'all') {
        filterParams.set('businessStatus', selectedBusinessStatus);
      }
      if (selectedCategory !== 'all') {
        filterParams.set('categoryId', selectedCategory);
      }
      if (selectedAccount !== 'all') {
        filterParams.set('accountId', selectedAccount);
      }
      // Date range filter
      filterParams.set('dateFrom', dateRangeStart.toISOString());
      filterParams.set('dateTo', dateRangeEnd.toISOString());

      const responses = await Promise.all([
        fetch(`/api/transactions?${filterParams.toString()}`),
        fetch('/api/properties'),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);

      if (responses.some((response) => !response.ok)) {
        throw new Error('โหลดข้อมูลไม่สำเร็จ');
      }

      const transactionsResponse = await responses[0].json() as Transaction[] | { data: Transaction[]; page: number; totalPages: number; total: number };
      const isPaginated = !Array.isArray(transactionsResponse) && 'data' in transactionsResponse;
      const newTransactions: Transaction[] = isPaginated ? transactionsResponse.data : transactionsResponse;
      const pagination = isPaginated
        ? {
            page: transactionsResponse.page,
            totalPages: transactionsResponse.totalPages,
            total: transactionsResponse.total,
          }
        : null;

      if (pagination) {
        if (isLoadMore) {
          setTransactions(prev => [...prev, ...newTransactions]);
          setCurrentPage(pagination.page);
          setTotalPages(pagination.totalPages);
          setTotalRecords(pagination.total);
        } else {
          setTransactions(newTransactions);
          setCurrentPage(pagination.page);
          setTotalPages(pagination.totalPages);
          setTotalRecords(pagination.total);
        }
      } else {
        setTransactions(newTransactions);
        setTotalRecords(newTransactions.length);
      }

      setProperties(await responses[1].json());
      setAccounts(await responses[2].json());
      setCategories(await responses[3].json());
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      loadData(true);
    }
  };

  useEffect(() => {
    // Reload when filters change - this replaces the client-side filter with server-side
    loadData().catch((error: Error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, [selectedType, selectedBusinessStatus, selectedCategory, selectedAccount, selectedDateFilter, customDateFrom, customDateTo]);

  const openCreate = (type: TransactionType = 'expense') => {
    setForm({
      ...emptyForm,
      type,
      date: today(),
      businessStatus: '',
    });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        date: new Date(`${form.date}T00:00:00`).toISOString(),
        propertyId: form.propertyId || null,
        categoryId: form.categoryId || null,
        businessStatus: form.businessStatus || null,
        sourceAccountId: form.sourceAccountId || null,
        destinationAccountId: form.destinationAccountId || null,
        note: form.note || null,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      showToast(payload.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      return;
    }

    showToast('บันทึกข้อมูลสำเร็จ', 'success');
    await loadData();
    setIsFormOpen(false);
  };

  const deleteTransaction = async (id: string) => {
    if (!window.confirm('ต้องการลบรายการนี้หรือไม่ ยอดบัญชีจะถูกย้อนกลับ')) return;
    setIsDeleting(id);

    const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setIsDeleting(null);

    if (!response.ok) {
      showToast('ไม่สามารถลบข้อมูลได้', 'error');
      return;
    }

    showToast('ลบข้อมูลสำเร็จ', 'success');
    await loadData();
  };

  const updateMetadata = async (data: {
    title: string;
    note: string;
    categoryId: string;
    businessStatus: '' | BusinessStatus;
    propertyId: string;
  }) => {
    if (!editingTransaction) return;
    setIsUpdating(true);

    const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: data.title || null,
        note: data.note || null,
        categoryId: data.categoryId || null,
        businessStatus: data.businessStatus || null,
        propertyId: data.propertyId || null,
      }),
    });

    setIsUpdating(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      showToast(payload.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      return;
    }

    showToast('บันทึกข้อมูลสำเร็จ', 'success');
    await loadData();
    setEditingTransaction(null);
  };

  const markBusinessReceived = async (id: string) => {
    setIsMarkingReceived(id);

    const response = await fetch(`/api/transactions/${id}/received`, { method: 'POST' });

    setIsMarkingReceived(null);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      showToast(payload.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      return;
    }

    showToast('บันทึกข้อมูลสำเร็จ', 'success');
    await loadData();
  };

  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);

  const getAccountLabel = (accountId: string | null) => {
    if (!accountId) return 'ไม่ระบุบัญชี';
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return accountNames.get(accountId) || 'ไม่ระบุบัญชี';
    return formatAccountDisplayName({
      accountType: account.accountType,
      accountAlias: account.accountAlias,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      name: account.name,
      owner: account.personName,
    });
  };

  // Search filter (client-side only - complex text matching)
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleTransactions = transactions.filter((transaction) => {
    if (normalizedSearch === '') return true;

    // Parse search as number (for amount matching)
    const searchAsNumber = normalizedSearch.replace(/,/g, '');
    const amountMatch = !isNaN(parseFloat(searchAsNumber));

    // Normalize amount for comparison (1227 matches 1,227.00)
    const transactionAmount = transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const transactionAmountNoComma = transactionAmount.replace(/,/g, '');

    const searchMatch =
      // Title
      transaction.title.toLowerCase().includes(normalizedSearch) ||
      // Note
      (transaction.note?.toLowerCase().includes(normalizedSearch) ?? false) ||
      // Category name
      (transaction.categoryName?.toLowerCase().includes(normalizedSearch) ?? false) ||
      // Source account name
      (transaction.sourceAccountName?.toLowerCase().includes(normalizedSearch) ?? false) ||
      // Destination account name
      (transaction.destinationAccountName?.toLowerCase().includes(normalizedSearch) ?? false) ||
      // Amount - exact or partial match on formatted amount
      (amountMatch && (
        transactionAmount.includes(searchAsNumber) ||
        transactionAmountNoComma.includes(searchAsNumber) ||
        normalizedSearch.includes(transactionAmount) ||
        normalizedSearch.includes(transactionAmountNoComma)
      ));

    return searchMatch;
  });

  // Sort by date descending (client-side only - Phase 1b scope)
  const sortedTransactions = useMemo(() => {
    return sortTransactions(visibleTransactions, sortOrder);
  }, [visibleTransactions, sortOrder]);

  const availableCategories = categories.filter((category) => category.type === form.type && category.isActive);

  // Count active filters
  const activeFilterCount =
    (selectedType !== 'all' ? 1 : 0) +
    (selectedBusinessStatus !== 'all' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedAccount !== 'all' ? 1 : 0);

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      {/* V4 Sticky Filter Bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/95 px-4 backdrop-blur-xl">
        {/* Row 1: Search + Sort + Filter Button */}
        <div className="flex items-center gap-2 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ค้นหารายการ..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => {
              const newOrder = e.target.value as SortOrder;
              setSortOrder(newOrder);
              localStorage.setItem(SORT_PREFERENCE_KEY, newOrder);
            }}
            className="h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
            aria-label="เปิดตัวกรอง"
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: Date Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
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

        {/* Custom Date Range - Show when 'custom' is selected */}
        {selectedDateFilter === 'custom' && (
          <div className="flex gap-2 pb-3">
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

        {/* Row 3: Result Count */}
        <div className="flex items-center gap-2 pb-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <span className="text-base">📅</span>
            {formatDateRange(dateRangeStart, dateRangeEnd)}
          </span>
          <span>•</span>
          <span>
            {sortedTransactions.length} รายการ
            {totalRecords > sortedTransactions.length && (
              <span className="ml-1">จาก {totalRecords.toLocaleString('th-TH')}</span>
            )}
          </span>
        </div>
      </header>

      {/* Transaction List */}
      <section className="space-y-3 px-4 py-4">
        {errorMessage && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}

        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : sortedTransactions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {sortedTransactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onEdit={setEditingTransaction}
                onView={setViewingTransaction}
                onReceived={markBusinessReceived}
                onDelete={deleteTransaction}
                isDeleting={isDeleting === transaction.id}
                isMarkingReceived={isMarkingReceived === transaction.id}
                isAdmin={isAdmin}
              />
            ))}

            {/* Load More Button */}
            {currentPage < totalPages && (
              <div className="py-4 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังโหลด...
                    </>
                  ) : (
                    <>
                      โหลดรายการเพิ่มเติม
                      <span className="text-slate-400">
                        ({Math.min(currentPage * PAGE_LIMIT, totalRecords)}/{totalRecords.toLocaleString('th-TH')})
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsAddSheetOpen(true)}
        disabled={accounts.length === 0}
        className="fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 md:bottom-6"
        aria-label="เพิ่มรายการใหม่"
      >
        <span className="text-2xl">+</span>
      </button>

      {/* Add Transaction Bottom Sheet */}
      <AddTransactionSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        onSelect={(type) => {
          setIsAddSheetOpen(false);
          openCreate(type);
        }}
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedStatus={selectedBusinessStatus}
        setSelectedStatus={setSelectedBusinessStatus}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        categories={categories}
        accounts={accounts}
        onClear={() => {
          setSelectedType('all');
          setSelectedBusinessStatus('all');
          setSelectedCategory('all');
          setSelectedAccount('all');
        }}
      />

      {/* Transaction Form Modal */}
      {isFormOpen && (
        <TransactionForm
          form={form}
          setForm={setForm}
          properties={properties}
          accounts={accounts}
          categories={availableCategories}
          onClose={() => setIsFormOpen(false)}
          onSubmit={saveTransaction}
          isSaving={isSaving}
        />
      )}

      {/* Edit Metadata Modal */}
      {editingTransaction && (
        <TransactionMetadataForm
          transaction={editingTransaction}
          categories={categories.filter((category) => category.type === editingTransaction.type && category.isActive)}
          properties={properties}
          onClose={() => setEditingTransaction(null)}
          onSubmit={updateMetadata}
          isSaving={isUpdating}
        />
      )}

      {/* View Detail Modal */}
      {viewingTransaction && (
        <TransactionDetailModal
          transaction={viewingTransaction}
          onClose={() => setViewingTransaction(null)}
          onEdit={(tx) => {
            setViewingTransaction(null);
            setEditingTransaction(tx);
          }}
          onDelete={deleteTransaction}
          isAdmin={isAdmin}
        />
      )}

      <MobileNav />
    </main>
  );
}

// Filter Bottom Sheet Component
function FilterBottomSheet({
  isOpen,
  onClose,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  selectedCategory,
  setSelectedCategory,
  selectedAccount,
  setSelectedAccount,
  categories,
  accounts,
  onClear,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedType: 'all' | TransactionType;
  setSelectedType: (type: 'all' | TransactionType) => void;
  selectedStatus: 'all' | BusinessStatus;
  setSelectedStatus: (status: 'all' | BusinessStatus) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedAccount: string;
  setSelectedAccount: (account: string) => void;
  categories: Category[];
  accounts: Account[];
  onClear: () => void;
}) {
  if (!isOpen) return null;

  const typeOptions: { value: 'all' | TransactionType; label: string }[] = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'income', label: 'รายรับ' },
    { value: 'expense', label: 'รายจ่าย' },
    { value: 'transfer', label: 'โอนเงิน' },
    { value: 'adjustment', label: 'ปรับยอด' },
  ];

  const statusOptions: { value: 'all' | BusinessStatus; label: string }[] = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'pending', label: 'รอชำระ' },
    { value: 'received', label: 'รับชำระแล้ว' },
  ];

  const activeCategories = categories.filter(c => c.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
      <div className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[80vh] sm:max-w-md sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">ตัวกรองเพิ่มเติม</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Type Filter */}
          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span>💰</span> ประเภท
            </h3>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedType(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedType === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span>📊</span> สถานะ
            </h3>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedStatus(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedStatus === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span>🏷️</span> หมวดหมู่
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              {activeCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Account Filter */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span>🏦</span> บัญชี
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedAccount('all')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedAccount === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              {/* Sort accounts: by person total balance, then by account balance */}
              {accounts
                .slice()
                .sort((a, b) => b.currentBalance - a.currentBalance)
                .map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccount(account.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      selectedAccount === account.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {formatAccountLabel(account)}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4 pb-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClear}
              className="h-12 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
            >
              ล้างตัวกรอง
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-12 flex-1 rounded-xl bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
            >
              ตกลง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Transaction Bottom Sheet
function AddTransactionSheet({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: TransactionType) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
      <div className="flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">เพิ่มรายการใหม่</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 px-5 py-4 pb-6">
          <button
            type="button"
            onClick={() => onSelect('income')}
            className="surface-card flex items-center gap-4 p-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ArrowDownLeft size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">รายรับ</p>
              <p className="text-sm text-slate-500">บันทึกรายรับ เงินเดือน ผลตอบแทน</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('expense')}
            className="surface-card flex items-center gap-4 p-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700">
              <ArrowUpRight size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">รายจ่าย</p>
              <p className="text-sm text-slate-500">บันทึกรายจ่าย ค่าใช้จ่าย บิล</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('transfer')}
            className="surface-card flex items-center gap-4 p-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
              <ArrowLeftRight size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">โอนเงิน</p>
              <p className="text-sm text-slate-500">โอนระหว่างบัญชี</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionCard({ transaction, onEdit, onView, onReceived, onDelete, isDeleting, isMarkingReceived, isAdmin }: { transaction: Transaction; onEdit: (transaction: Transaction) => void; onView: (transaction: Transaction) => void; onReceived: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; isDeleting: boolean; isMarkingReceived: boolean; isAdmin: boolean }) {
  const typeLabels: Record<TransactionType, string> = {
    income: 'รายรับ',
    expense: 'รายจ่าย',
    transfer: 'โอนเงิน',
    adjustment: 'ปรับยอดบัญชี',
  };

  // Hide edit/delete for adjustments unless admin
  const canEdit = transaction.type !== 'adjustment' || isAdmin;
  const canDelete = transaction.type !== 'adjustment' || isAdmin;

  const getAccountBadge = (isBusiness: boolean | null, accountType: 'bank' | 'cash' | null) => {
    if (isBusiness === true) return '🏢 บัญชีธุรกิจ';
    if (accountType === 'cash') return '💵 เงินสด';
    return '👤 บัญชีส่วนตัว';
  };

  const getAccountInfo = (account: typeof transaction) => {
    const name = account.type === 'income' ? transaction.destinationAccountName : transaction.sourceAccountName;
    const bank = account.type === 'income' ? transaction.destinationAccountBank : transaction.sourceAccountBank;
    const number = account.type === 'income' ? transaction.destinationAccountNumber : transaction.sourceAccountNumber;
    const alias = account.type === 'income' ? transaction.destinationAccountAlias : transaction.sourceAccountAlias;
    const isBusiness = account.type === 'income' ? transaction.destinationIsBusinessAccount : transaction.sourceIsBusinessAccount;
    const accType = account.type === 'income' ? transaction.destinationAccountType : transaction.sourceAccountType;
    const owner = account.type === 'income' ? transaction.destinationPersonName : transaction.sourcePersonName;

    if (!name) return null;
    const badge = getAccountBadge(isBusiness, accType);
    const display = formatAccountDisplayName({
      accountType: accType ?? 'bank',
      accountAlias: alias,
      bankName: bank,
      accountNumber: number,
      name,
      owner,
    });
    return { badge, display, icon: account.type === 'income' ? '📥' : '📤', label: account.type === 'income' ? 'เงินเข้า' : 'เงินออก' };
  };

  const accountInfo = getAccountInfo(transaction);

  const categoryDisplay = transaction.categoryName ?? (transaction.categoryId ? '(หมวดหมู่ถูกลบ)' : '—');

  const statusLabels: Record<BusinessStatus, string> = {
    pending: 'รอชำระ',
    received: 'รับชำระแล้ว',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const amountColor = transaction.type === 'expense' ? 'text-rose-700' : transaction.type === 'transfer' ? 'text-indigo-700' : 'text-emerald-700';
  const typeColor = transaction.type === 'expense' ? 'text-rose-600' : transaction.type === 'transfer' ? 'text-indigo-600' : 'text-emerald-600';

  return (
    <article onClick={() => onView(transaction)} className="surface-card cursor-pointer overflow-hidden p-4">
      {/* Type Label + Title */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{typeLabels[transaction.type]}</p>
          <h2 className="mt-0.5 truncate font-semibold text-slate-900">{transaction.title}</h2>
        </div>
        {canEdit && canDelete ? (
          <div className="flex gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(transaction); }} aria-label={`แก้ไข ${transaction.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <Pencil size={16} />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); void onDelete(transaction.id); }} disabled={isDeleting} aria-label={`ลบ ${transaction.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50">
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">ปรับยอด</span>
          </div>
        )}
      </div>

      {/* Note - Show when exists */}
      {transaction.note && (
        <p className="mt-1.5 truncate text-sm italic text-slate-500">
          📝 {transaction.note}
        </p>
      )}

      {/* Amount - Large and prominent */}
      <p className={`mt-3 text-2xl font-bold tracking-tight ${amountColor}`}>
        {transaction.type === 'expense' ? '-' : '+'}{transaction.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
      </p>

      {/* Account Block - Income/Expense */}
      {transaction.type !== 'transfer' && accountInfo && (
        <div className="mt-3">
          <p className={`text-xs font-medium ${typeColor}`}>{accountInfo.icon} {accountInfo.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">{accountInfo.badge}</p>
          <p className="text-sm font-medium text-slate-900">{accountInfo.display}</p>
        </div>
      )}

      {/* Account Block - Transfer */}
      {transaction.type === 'transfer' && (
        <div className="mt-3 space-y-2">
          {transaction.sourceAccountName && (
            <div>
              <p className="text-xs font-medium text-rose-600">📤 ต้นทาง</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">
                {getAccountBadge(transaction.sourceIsBusinessAccount, transaction.sourceAccountType)}
              </p>
              <p className="text-sm font-medium text-slate-900 whitespace-pre-line">
                {formatAccountDisplayName({
                  accountType: transaction.sourceAccountType ?? 'bank',
                  accountAlias: transaction.sourceAccountAlias,
                  bankName: transaction.sourceAccountBank,
                  accountNumber: transaction.sourceAccountNumber,
                  name: transaction.sourceAccountName ?? undefined,
                  owner: transaction.sourcePersonName ?? undefined,
                })}
              </p>
            </div>
          )}
          <div className="flex items-center justify-center py-1">
            <span className="text-xl text-slate-400">↓</span>
          </div>
          {transaction.destinationAccountName && (
            <div>
              <p className="text-xs font-medium text-emerald-600">📥 ปลายทาง</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">
                {getAccountBadge(transaction.destinationIsBusinessAccount, transaction.destinationAccountType)}
              </p>
              <p className="text-sm font-medium text-slate-900 whitespace-pre-line">
                {formatAccountDisplayName({
                  accountType: transaction.destinationAccountType ?? 'bank',
                  accountAlias: transaction.destinationAccountAlias,
                  bankName: transaction.destinationAccountBank,
                  accountNumber: transaction.destinationAccountNumber,
                  name: transaction.destinationAccountName ?? undefined,
                  owner: transaction.destinationPersonName ?? undefined,
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Category + Status on same line */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {transaction.type !== 'transfer' && transaction.categoryName && (
          <span className="text-sm font-medium text-slate-600">🏷️ {categoryDisplay}</span>
        )}
        {transaction.businessStatus && (
          <span className={`text-sm font-medium ${transaction.businessStatus === 'pending' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {statusLabels[transaction.businessStatus]}
          </span>
        )}
      </div>

      {/* Adjustment Reason */}
      {transaction.type === 'adjustment' && transaction.adjustmentReason && (
        <div className="mt-3 rounded-lg bg-orange-50 p-2">
          <p className="text-xs font-medium text-orange-700">📝 เหตุผลการปรับยอด</p>
          <p className="mt-1 text-sm text-orange-900">{transaction.adjustmentReason}</p>
        </div>
      )}

      {/* Date & Received Button */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">{formatDate(transaction.date)}</p>
        {transaction.type === 'income' && transaction.businessStatus === 'pending' && (
          <button
            type="button"
            onClick={() => void onReceived(transaction.id)}
            disabled={isMarkingReceived}
            className="touch-button rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isMarkingReceived ? 'กำลังอัปเดต...' : 'รับชำระแล้ว'}
          </button>
        )}
      </div>
    </article>
  );
}

function TransactionForm({ form, setForm, properties, accounts, categories, onClose, onSubmit, isSaving }: { form: FormState; setForm: (form: FormState) => void; properties: Property[]; accounts: Account[]; categories: Category[]; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>; isSaving: boolean }) {
  const update = (values: Partial<FormState>) => setForm({ ...form, ...values });
  const isTransfer = form.type === 'transfer';
  const sameAccountSelected =
    (form.type === 'expense' || form.type === 'transfer') &&
    !!form.sourceAccountId &&
    !!form.destinationAccountId &&
    form.sourceAccountId === form.destinationAccountId;

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
      <form onSubmit={onSubmit} className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        
        {/* Header with X Close Button Only */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">{form.type === 'income' ? 'เพิ่มรายรับ' : form.type === 'expense' ? 'เพิ่มรายจ่าย' : 'เพิ่มรายการโอน'}</h2>
          <button type="button" onClick={onClose} aria-label="ปิดฟอร์ม" className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FormLabel label="หัวข้อ">
            <input required value={form.title} onChange={(event) => update({ title: event.target.value })} className="form-input" />
          </FormLabel>

          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-3">
              <FormLabel label="จำนวนเงิน">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-slate-500">฿</span>
                  <input required min="0.01" step="0.01" type="number" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => update({ amount: event.target.value })} className="form-input w-full pl-8 pr-3" />
                </div>
              </FormLabel>
            </div>
            <div className="sm:col-span-2">
              <FormLabel label="วันที่">
                <input required type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} className="form-input w-full" />
              </FormLabel>
            </div>
          </div>

          {!isTransfer && (
            <FormLabel label="หมวดหมู่">
              <select required value={form.categoryId} onChange={(event) => update({ categoryId: event.target.value })} className="form-input">
                <option value="">เลือกหมวดหมู่</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </FormLabel>
          )}

          {form.type === 'income' && (
            <FormLabel label="สถานะ">
              <BusinessStatusSelect value={form.businessStatus} onChange={(value) => update({ businessStatus: value })} />
            </FormLabel>
          )}

          {form.type === 'income' && (
            <FormLabel label="บัญชีปลายทาง">
              <AccountSelect value={form.destinationAccountId} accounts={accounts} onChange={(value) => update({ destinationAccountId: value })} />
            </FormLabel>
          )}

          {form.type === 'expense' && (
            <FormLabel label="บัญชีต้นทาง">
              <AccountSelect value={form.sourceAccountId} accounts={accounts} onChange={(value) => update({ sourceAccountId: value })} />
            </FormLabel>
          )}

          {isTransfer && (
            <>
              <FormLabel label="จากบัญชี">
                <AccountSelect value={form.sourceAccountId} accounts={accounts} onChange={(value) => update({ sourceAccountId: value })} />
              </FormLabel>
              <FormLabel label="ไปยังบัญชี">
                <AccountSelect value={form.destinationAccountId} accounts={accounts} onChange={(value) => update({ destinationAccountId: value })} />
              </FormLabel>
            </>
          )}

          {!isTransfer && (
            <FormLabel label="ทรัพย์สินที่เกี่ยวข้อง (ถ้ามี)">
              <PropertySelect value={form.propertyId} properties={properties} onChange={(value) => update({ propertyId: value })} />
            </FormLabel>
          )}

          <FormLabel label="หมายเหตุ">
            <div className="relative">
              <textarea
                value={form.note}
                onChange={(event) => update({ note: event.target.value })}
                placeholder="เพิ่มรายละเอียดเพิ่มเติม..."
                rows={3}
                className="form-input min-h-24 w-full resize-none p-3 leading-relaxed text-slate-900 placeholder:text-slate-400"
              />
              <p className="mt-1.5 text-xs text-slate-400">💡 ใช้บันทึกรายละเอียดเพิ่มเติม เช่น หมายเหตุการชำระเงิน</p>
            </div>
          </FormLabel>

          {sameAccountSelected && <p className="mt-3 text-sm text-rose-600">บัญชีต้นทางและปลายทางต้องไม่ใช่บัญชีเดียวกัน</p>}
        </div>

        {/* Sticky Footer with Cancel and Save Buttons */}
        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-12 w-full rounded-xl border border-slate-200 font-semibold text-slate-700 disabled:opacity-50">ยกเลิก</button>
            <button type="submit" disabled={isSaving} className="h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50">
              {isSaving ? <><Loader2 size={18} className="animate-spin" /> กำลังบันทึกรายการ...</> : 'บันทึก'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-4 block text-sm font-medium text-slate-700 first:mt-0">{label}{children}</label>;
}

function PropertySelect({ value, properties, onChange }: { value: string; properties: Property[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="form-input">
      <option value="">ไม่ระบุ</option>
      {properties.map((property) => (
        <option key={property.id} value={property.id}>{property.name}</option>
      ))}
    </select>
  );
}

function AccountSelect({ value, accounts, onChange }: { value: string; accounts: Account[]; onChange: (value: string) => void }) {
  const businessAccounts = accounts.filter(a => a.isBusinessAccount);
  const personalAccounts = accounts.filter(a => !a.isBusinessAccount);

  const formatAccountOption = (account: Account) => {
    return formatAccountForSelector({
      accountType: account.accountType,
      accountAlias: account.accountAlias,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      name: account.name,
      owner: account.personName,
    });
  };

  return (
    <select required value={value} onChange={(event) => onChange(event.target.value)} className="form-input">
      <option value="">เลือกบัญชี</option>
      {businessAccounts.length > 0 && (
        <optgroup label="🏢 บัญชีธุรกิจ">
          {businessAccounts.map((account) => (
            <option key={account.id} value={account.id}>{formatAccountOption(account)}</option>
          ))}
        </optgroup>
      )}
      {personalAccounts.length > 0 && (
        <optgroup label="👤 บัญชีส่วนตัว">
          {personalAccounts.map((account) => (
            <option key={account.id} value={account.id}>{formatAccountOption(account)}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function BusinessStatusSelect({ value, onChange }: { value: '' | BusinessStatus; onChange: (value: '' | BusinessStatus) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as '' | BusinessStatus)} className="form-input">
      <option value="">ไม่ระบุ</option>
      {Object.entries(businessStatusLabels).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  );
}

function TransactionMetadataForm({
  transaction,
  categories,
  properties,
  onClose,
  onSubmit,
  isSaving,
}: {
  transaction: Transaction;
  categories: Category[];
  properties: Property[];
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    note: string;
    categoryId: string;
    businessStatus: '' | BusinessStatus;
    propertyId: string;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(transaction.title || '');
  const [note, setNote] = useState(transaction.note || '');
  const [categoryId, setCategoryId] = useState(transaction.categoryId || '');
  const [businessStatus, setBusinessStatus] = useState<'' | BusinessStatus>(
    transaction.businessStatus || ''
  );
  const [propertyId, setPropertyId] = useState(transaction.propertyId || '');

  const typeLabels: Record<TransactionType, string> = {
    income: 'รายรับ',
    expense: 'รายจ่าย',
    transfer: 'โอนเงิน',
    adjustment: 'ปรับยอดบัญชี',
  };

  // Account label for locked-fields display
  const lockedAccount = (() => {
    if (transaction.type === 'transfer') {
      const src = formatAccountDisplayName({
        accountType: transaction.sourceAccountType ?? 'bank',
        accountAlias: transaction.sourceAccountAlias,
        bankName: transaction.sourceAccountBank,
        accountNumber: transaction.sourceAccountNumber,
        name: transaction.sourceAccountName ?? undefined,
        owner: transaction.sourcePersonName ?? undefined,
      });
      const dst = formatAccountDisplayName({
        accountType: transaction.destinationAccountType ?? 'bank',
        accountAlias: transaction.destinationAccountAlias,
        bankName: transaction.destinationAccountBank,
        accountNumber: transaction.destinationAccountNumber,
        name: transaction.destinationAccountName ?? undefined,
        owner: transaction.destinationPersonName ?? undefined,
      });
      return `${src}\n↓\n${dst}`;
    }
    if (transaction.type === 'income') {
      return formatAccountDisplayName({
        accountType: transaction.destinationAccountType ?? 'bank',
        accountAlias: transaction.destinationAccountAlias,
        bankName: transaction.destinationAccountBank,
        accountNumber: transaction.destinationAccountNumber,
        name: transaction.destinationAccountName ?? undefined,
        owner: transaction.destinationPersonName ?? undefined,
      });
    }
    if (transaction.type === 'expense') {
      return formatAccountDisplayName({
        accountType: transaction.sourceAccountType ?? 'bank',
        accountAlias: transaction.sourceAccountAlias,
        bankName: transaction.sourceAccountBank,
        accountNumber: transaction.sourceAccountNumber,
        name: transaction.sourceAccountName ?? undefined,
        owner: transaction.sourcePersonName ?? undefined,
      });
    }
    return formatAccountDisplayName({
      accountType: transaction.sourceAccountType ?? 'bank',
      accountAlias: transaction.sourceAccountAlias,
      bankName: transaction.sourceAccountBank,
      accountNumber: transaction.sourceAccountNumber,
      name: transaction.sourceAccountName ?? undefined,
      owner: transaction.sourcePersonName ?? undefined,
    });
  })();

  const amountPrefix = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';
  const amountColor = transaction.type === 'income'
    ? 'text-emerald-700'
    : transaction.type === 'expense'
      ? 'text-rose-700'
      : transaction.type === 'transfer'
        ? 'text-indigo-700'
        : 'text-orange-700';

  const thaiDate = new Date(transaction.date).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            title: title.trim(),
            note: note.trim(),
            categoryId,
            businessStatus,
            propertyId,
          });
        }}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">แก้ไขรายการ</h2>
          <button type="button" onClick={onClose} aria-label="ปิดฟอร์ม" className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Editable fields */}
          <FormLabel label="ชื่อรายการ">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ชื่อรายการ"
              maxLength={200}
              required
              className="form-input"
            />
          </FormLabel>

          <FormLabel label="หมายเหตุ">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="เพิ่มรายละเอียดเพิ่มเติม (ถ้ามี)"
              rows={3}
              maxLength={1000}
              className="form-input min-h-20 w-full resize-none p-3 leading-relaxed"
            />
          </FormLabel>

          {transaction.type !== 'transfer' && (
            <FormLabel label="หมวดหมู่">
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="form-input"
              >
                <option value="">ไม่ระบุ</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </FormLabel>
          )}

          {transaction.type === 'income' && (
            <FormLabel label="สถานะ">
              <BusinessStatusSelect value={businessStatus} onChange={setBusinessStatus} />
            </FormLabel>
          )}

          {transaction.type !== 'transfer' && (
            <FormLabel label="ทรัพย์สินที่เกี่ยวข้อง">
              <PropertySelect
                value={propertyId}
                properties={properties}
                onChange={setPropertyId}
              />
            </FormLabel>
          )}

          {/* Locked fields — read-only summary */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              ข้อมูลที่ไม่สามารถแก้ไขได้
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">จำนวนเงิน</p>
                <p className={`text-lg font-bold ${amountColor}`}>
                  {amountPrefix}{Math.abs(transaction.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">บัญชี</p>
                <p className="text-sm font-medium text-slate-800">{lockedAccount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ประเภท</p>
                <p className="text-sm font-medium text-slate-800">{typeLabels[transaction.type]}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">วันที่</p>
                <p className="text-sm font-medium text-slate-800">{thaiDate}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] italic text-slate-400">
              หากต้องการเปลี่ยนแปลงข้อมูลเหล่านี้ กรุณาลบรายการเดิมแล้วสร้างใหม่
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-12 w-full rounded-xl border border-slate-200 font-semibold text-slate-700 disabled:opacity-50">ยกเลิก</button>
            <button type="submit" disabled={isSaving} className="h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50">
              {isSaving ? <><Loader2 size={18} className="animate-spin" /> กำลังบันทึก...</> : 'บันทึก'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface-card border-dashed px-5 py-12 text-center">
      <ArrowLeftRight className="mx-auto text-slate-400" size={30} />
      <p className="mt-3 font-medium text-slate-700">ยังไม่มีรายการที่ตรงกัน</p>
      <p className="mt-1 text-sm text-slate-500">เพิ่มรายการใหม่ได้โดยกดปุ่ม + ด้านล่าง</p>
    </div>
  );
}

function TransactionDetailModal({ transaction, onClose, onEdit, onDelete, isAdmin }: { transaction: Transaction; onClose: () => void; onEdit: (transaction: Transaction) => void; onDelete: (id: string) => Promise<void>; isAdmin: boolean }) {
  const typeLabels: Record<TransactionType, string> = {
    income: 'รายรับ',
    expense: 'รายจ่าย',
    transfer: 'โอนเงิน',
    adjustment: 'ปรับยอดบัญชี',
  };
  const typeColors: Record<TransactionType, string> = {
    income: 'text-emerald-700',
    expense: 'text-rose-700',
    transfer: 'text-indigo-700',
    adjustment: 'text-orange-700',
  };
  const statusColors: Record<BusinessStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    received: 'bg-emerald-50 text-emerald-700',
  };

  // Hide edit/delete for adjustments unless admin
  const canEdit = transaction.type !== 'adjustment' || isAdmin;
  const canDelete = transaction.type !== 'adjustment' || isAdmin;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5" onClick={onClose}>
      <div className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">รายละเอียดรายการ</h2>
          <button type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Title & Amount */}
          <div className="text-center">
            <span className={`text-sm font-medium ${typeColors[transaction.type]}`}>{typeLabels[transaction.type]}</span>
            <p className={`mt-1 text-3xl font-bold ${typeColors[transaction.type]}`}>
              {transaction.type === 'expense' ? '-' : '+'}{transaction.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{transaction.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(transaction.date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {transaction.businessStatus && (
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColors[transaction.businessStatus]}`}>
                {businessStatusLabels[transaction.businessStatus]}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="my-5 border-t border-slate-100" />

          {/* Details */}
          <div className="space-y-4">
            {/* Category */}
            {transaction.categoryName && (
              <DetailRow label="หมวดหมู่" value={transaction.categoryName} icon="🏷️" />
            )}

            {/* Accounts */}
            {transaction.type === 'transfer' && (
              <>
                <DetailRow
                  label="จากบัญชี"
                  value={formatAccountDisplayName({
                    accountType: transaction.sourceAccountType ?? 'bank',
                    accountAlias: transaction.sourceAccountAlias,
                    bankName: transaction.sourceAccountBank,
                    accountNumber: transaction.sourceAccountNumber,
                    name: transaction.sourceAccountName ?? undefined,
                    owner: transaction.sourcePersonName ?? undefined,
                  })}
                  icon="📤"
                />
                <DetailRow
                  label="ไปยังบัญชี"
                  value={formatAccountDisplayName({
                    accountType: transaction.destinationAccountType ?? 'bank',
                    accountAlias: transaction.destinationAccountAlias,
                    bankName: transaction.destinationAccountBank,
                    accountNumber: transaction.destinationAccountNumber,
                    name: transaction.destinationAccountName ?? undefined,
                    owner: transaction.destinationPersonName ?? undefined,
                  })}
                  icon="📥"
                />
              </>
            )}
            {transaction.type === 'income' && (
              <DetailRow
                label="เข้าบัญชี"
                value={formatAccountDisplayName({
                  accountType: transaction.destinationAccountType ?? 'bank',
                  accountAlias: transaction.destinationAccountAlias,
                  bankName: transaction.destinationAccountBank,
                  accountNumber: transaction.destinationAccountNumber,
                  name: transaction.destinationAccountName ?? undefined,
                  owner: transaction.destinationPersonName ?? undefined,
                })}
                icon="📥"
              />
            )}
            {transaction.type === 'expense' && (
              <DetailRow
                label="จากบัญชี"
                value={formatAccountDisplayName({
                  accountType: transaction.sourceAccountType ?? 'bank',
                  accountAlias: transaction.sourceAccountAlias,
                  bankName: transaction.sourceAccountBank,
                  accountNumber: transaction.sourceAccountNumber,
                  name: transaction.sourceAccountName ?? undefined,
                  owner: transaction.sourcePersonName ?? undefined,
                })}
                icon="📤"
              />
            )}

            {/* Property */}
            {transaction.propertyName && (
              <DetailRow label="ทรัพย์สิน" value={transaction.propertyName} icon="🏠" />
            )}

            {/* Note */}
            {transaction.note && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">หมายเหตุ</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{transaction.note}</p>
              </div>
            )}

            {/* Adjustment Reason */}
            {transaction.type === 'adjustment' && transaction.adjustmentReason && (
              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-orange-600">เหตุผลการปรับยอด</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-orange-900">{transaction.adjustmentReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="border-t border-slate-100 px-5 py-4 pb-6">
          {canEdit || canDelete ? (
            <div className="flex gap-3">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void onEdit(transaction)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 h-12 font-semibold text-white"
                >
                  <Pencil size={18} />
                  แก้ไข
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('ต้องการลบรายการนี้หรือไม่')) {
                      void onDelete(transaction.id);
                      onClose();
                    }
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 h-12 px-5 font-semibold text-rose-600"
                >
                  <Trash2 size={18} />
                  ลบ
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-orange-50 p-3 text-center">
              <p className="text-sm font-medium text-orange-700">🔒 รายการปรับยอด - ต้องเป็น Admin ถึงจะแก้ไขได้</p>
            </div>
          )}
          <button type="button" onClick={onClose} className="mt-3 h-11 w-full rounded-xl bg-slate-100 font-semibold text-slate-700">ปิด</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
