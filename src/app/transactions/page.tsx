'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight,ArrowRightLeft, CircleMinus, CirclePlus, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';

type TransactionType = 'income' | 'expense' | 'transfer';
type BusinessStatus = 'pending' | 'received';
type Property = { id: string; name: string };
type Account = { id: string; name: string; accountNumber: string | null; bankName: string | null; currentBalance: number; isBusinessAccount: boolean };
type Category = { id: string; name: string; type: 'income' | 'expense'; isActive: boolean };
type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  title: string;
  propertyId: string | null;
  propertyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  businessStatus: BusinessStatus | null;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  sourceAccountBank: string | null;
  sourceAccountNumber: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  destinationAccountBank: string | null;
  destinationAccountNumber: string | null;
  note: string | null;
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
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-5 pb-5 pt-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-label">เงินเข้า เงินออก และการโอน</p>
            <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">รายการเงิน</h1>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 px-2 text-center opacity-45">
            <span><CirclePlus size={27} /></span>
            <span className="mt-2 text-sm font-bold text-emerald-700">รายรับ</span>
            <span className="mt-1 text-[10px] leading-tight text-slate-500">รับเงินลูกค้า</span>
          </div>
          <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 px-2 text-center opacity-45">
            <span><CircleMinus size={27} /></span>
            <span className="mt-2 text-sm font-bold text-rose-700">รายจ่าย</span>
            <span className="mt-1 text-[10px] leading-tight text-slate-500">ต้นทุนและค่าใช้จ่าย</span>
          </div>
          <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-2 text-center opacity-45">
            <span><ArrowRightLeft size={27} /></span>
            <span className="mt-2 text-sm font-bold text-indigo-700">โอนเงิน</span>
            <span className="mt-1 text-[10px] leading-tight text-slate-500">ย้ายระหว่างบัญชี</span>
          </div>
        </div>
      </header>
      <section className="space-y-3 px-5 py-5">
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

  // Initialize filters from URL params
  const urlType = searchParams.get('type');
  const urlBusinessStatus = searchParams.get('businessStatus');
  const validTypes: TransactionType[] = ['income', 'expense', 'transfer'];
  const validStatuses: BusinessStatus[] = ['pending', 'received'];

  const [selectedType, setSelectedType] = useState<'all' | TransactionType>(
    urlType && validTypes.includes(urlType as TransactionType) ? urlType as TransactionType : 'all'
  );
  const [selectedBusinessStatus, setSelectedBusinessStatus] = useState<'all' | BusinessStatus>(
    urlBusinessStatus && validStatuses.includes(urlBusinessStatus as BusinessStatus) ? urlBusinessStatus as BusinessStatus : 'all'
  );

  // Sync filters with URL changes
  useEffect(() => {
    const newType = urlType && validTypes.includes(urlType as TransactionType) ? urlType as TransactionType : 'all';
    setSelectedType(newType);
  }, [urlType]);

  useEffect(() => {
    const newStatus = urlBusinessStatus && validStatuses.includes(urlBusinessStatus as BusinessStatus) ? urlBusinessStatus as BusinessStatus : 'all';
    setSelectedBusinessStatus(newStatus);
  }, [urlBusinessStatus]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMarkingReceived, setIsMarkingReceived] = useState<string | null>(null);
  const { showToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    const responses = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/properties'),
      fetch('/api/accounts'),
      fetch('/api/categories'),
    ]);

    if (responses.some((response) => !response.ok)) {
      throw new Error('โหลดข้อมูลไม่สำเร็จ');
    }

    setTransactions(await responses[0].json());
    setProperties(await responses[1].json());
    setAccounts(await responses[2].json());
    setCategories(await responses[3].json());
  };

  useEffect(() => {
    loadData().catch((error: Error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, []);

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

  const updateMetadata = async (categoryId: string, businessStatus: '' | BusinessStatus) => {
    if (!editingTransaction) return;
    setIsUpdating(true);

    const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryId: categoryId || null, businessStatus: businessStatus || null }),
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
    return `${account.name}${account.accountNumber ? ` (${account.accountNumber})` : ''}`;
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleTransactions = transactions.filter(
    (transaction) =>
      (selectedType === 'all' || transaction.type === selectedType) &&
      (selectedBusinessStatus === 'all' || transaction.businessStatus === selectedBusinessStatus) &&
      (selectedCategory === 'all' || transaction.categoryId === selectedCategory) &&
      (normalizedSearch === '' ||
        transaction.title.toLowerCase().includes(normalizedSearch) ||
        (transaction.note?.toLowerCase().includes(normalizedSearch) ?? false))
  );

  const availableCategories = categories.filter((category) => category.type === form.type && category.isActive);

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-5 pb-5 pt-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-label">เงินเข้า เงินออก และการโอน</p>
            <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">รายการเงิน</h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <ActionCard label="รายรับ" description="รับเงินลูกค้า" icon={<CirclePlus size={27} />} color="emerald" disabled={accounts.length === 0} onClick={() => openCreate('income')} />
          <ActionCard label="รายจ่าย" description="ต้นทุนและค่าใช้จ่าย" icon={<CircleMinus size={27} />} color="rose" disabled={accounts.length === 0} onClick={() => openCreate('expense')} />
          <ActionCard label="โอนเงิน" description="ย้ายระหว่างบัญชี" icon={<ArrowRightLeft size={27} />} color="indigo" disabled={accounts.length < 2} onClick={() => openCreate('transfer')} />
        </div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}

        <div className="grid grid-cols-3 gap-2">
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as 'all' | TransactionType)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="all">ทุกประเภท</option>
            <option value="income">รายรับ</option>
            <option value="expense">รายจ่าย</option>
            <option value="transfer">โอนเงิน</option>
          </select>

          <select value={selectedBusinessStatus} onChange={(event) => setSelectedBusinessStatus(event.target.value as 'all' | BusinessStatus)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="all">ทุกสถานะ</option>
            {Object.entries(businessStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="all">ทุกหมวดหมู่</option>
            {categories.filter((c) => c.isActive).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

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

        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : visibleTransactions.length === 0 ? (
          <EmptyState />
        ) : (
          visibleTransactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              getAccountLabel={getAccountLabel}
              onEdit={setEditingTransaction}
              onView={setViewingTransaction}
              onReceived={markBusinessReceived}
              onDelete={deleteTransaction}
              isDeleting={isDeleting === transaction.id}
              isMarkingReceived={isMarkingReceived === transaction.id}
            />
          ))
        )}
      </section>

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

      {editingTransaction && (
        <TransactionMetadataForm
          transaction={editingTransaction}
          categories={categories.filter((category) => category.type === editingTransaction.type && category.isActive)}
          onClose={() => setEditingTransaction(null)}
          onSubmit={updateMetadata}
          isSaving={isUpdating}
        />
      )}

      {viewingTransaction && (
        <TransactionDetailModal
          transaction={viewingTransaction}
          onClose={() => setViewingTransaction(null)}
        />
      )}

      <MobileNav />
    </main>
  );
}

function ActionCard({ label, description, icon, color, disabled, onClick }: { label: string; description: string; icon: React.ReactNode; color: 'emerald' | 'rose' | 'indigo'; disabled: boolean; onClick: () => void }) {
  const colors = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  };

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border px-2 text-center disabled:opacity-45 ${colors[color]}`}>
      <span>{icon}</span>
      <span className="mt-2 text-sm font-bold">{label}</span>
      <span className="mt-1 text-[10px] leading-tight text-slate-500">{description}</span>
    </button>
  );
}

function TransactionCard({ transaction, getAccountLabel, onEdit, onView, onReceived, onDelete, isDeleting, isMarkingReceived }: { transaction: Transaction; getAccountLabel: (accountId: string | null) => string; onEdit: (transaction: Transaction) => void; onView: (transaction: Transaction) => void; onReceived: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; isDeleting: boolean; isMarkingReceived: boolean }) {
  const icon = transaction.type === 'income' ? <ArrowDownLeft size={18} /> : transaction.type === 'expense' ? <ArrowUpRight size={18} /> : <ArrowLeftRight size={18} />;
  const color = transaction.type === 'income' ? 'bg-emerald-50 text-emerald-700' : transaction.type === 'expense' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700';
  const badgeClass = transaction.businessStatus === 'pending' ? 'bg-amber-50 text-amber-700' : transaction.businessStatus === 'received' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600';

  return (
    <article className="surface-card overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <button type="button" onClick={() => onView(transaction)} className="flex w-full items-start gap-2 text-left">
            <span className={`grid min-h-10 min-w-10 shrink-0 place-items-center rounded-2xl ${color}`}>{icon}</span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 className="truncate font-semibold text-slate-900">{transaction.title}</h2>
              <p className="truncate text-xs text-slate-500">{new Date(transaction.date).toLocaleDateString('th-TH')}</p>
            </div>
          </button>

          <p className={`mt-3 truncate text-xl font-bold tracking-tight ${transaction.type === 'expense' ? 'text-rose-700' : transaction.type === 'transfer' ? 'text-indigo-700' : 'text-emerald-700'}`}>
            {transaction.type === 'expense' ? '-' : '+'}{transaction.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {transaction.type === 'transfer'
              ? `${getAccountLabel(transaction.sourceAccountId)} → ${getAccountLabel(transaction.destinationAccountId)}`
              : transaction.type === 'income'
                ? getAccountLabel(transaction.destinationAccountId)
                : getAccountLabel(transaction.sourceAccountId)}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              🏷️ {transaction.categoryName ?? '(หมวดหมู่ถูกลบ)'}
            </span>
            {transaction.businessStatus && (
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass}`}>
                {businessStatusLabels[transaction.businessStatus]}
              </span>
            )}
          </div>

          {transaction.type === 'income' && transaction.businessStatus === 'pending' && (
            <button type="button" onClick={() => void onReceived(transaction.id)} disabled={isMarkingReceived} className="touch-button mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {isMarkingReceived ? <><Loader2 size={16} className="animate-spin" /> กำลังอัปเดต...</> : 'รับชำระแล้ว'}
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit(transaction)} aria-label={`แก้ไข ${transaction.title}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <Pencil size={18} />
          </button>
          <button type="button" onClick={() => void onDelete(transaction.id)} disabled={isDeleting} aria-label={`ลบ ${transaction.title}`} className="touch-button grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 disabled:opacity-50">
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
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
            <textarea value={form.note} onChange={(event) => update({ note: event.target.value })} className="form-input min-h-24 resize-none" />
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

  return (
    <select required value={value} onChange={(event) => onChange(event.target.value)} className="form-input">
      <option value="">เลือกบัญชี</option>
      {businessAccounts.length > 0 && (
        <optgroup label="🏢 บัญชีธุรกิจ">
          {businessAccounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </optgroup>
      )}
      {personalAccounts.length > 0 && (
        <optgroup label="👤 บัญชีส่วนตัว">
          {personalAccounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
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

function TransactionMetadataForm({ transaction, categories, onClose, onSubmit, isSaving }: { transaction: Transaction; categories: Category[]; onClose: () => void; onSubmit: (categoryId: string, businessStatus: '' | BusinessStatus) => Promise<void>; isSaving: boolean }) {
  const [categoryId, setCategoryId] = useState(transaction.categoryId || '');
  const [businessStatus, setBusinessStatus] = useState<'' | BusinessStatus>(transaction.businessStatus || '');

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(categoryId, businessStatus);
        }}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">หมวดหมู่และสถานะ</h2>
          <button type="button" onClick={onClose} aria-label="ปิดฟอร์ม" className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {transaction.type !== 'transfer' && (
            <FormLabel label="หมวดหมู่">
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="form-input">
                <option value="">ไม่ระบุ</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </FormLabel>
          )}

          <FormLabel label="สถานะ">
            <BusinessStatusSelect value={businessStatus} onChange={setBusinessStatus} />
          </FormLabel>
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
      <p className="mt-1 text-sm text-slate-500">เพิ่มรายรับ รายจ่าย หรือรายการโอนได้จากปุ่มด้านบน</p>
    </div>
  );
}

function TransactionDetailModal({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const typeLabels: Record<TransactionType, string> = {
    income: 'รายรับ',
    expense: 'รายจ่าย',
    transfer: 'โอนเงิน',
  };
  const typeColors: Record<TransactionType, string> = {
    income: 'text-emerald-700',
    expense: 'text-rose-700',
    transfer: 'text-indigo-700',
  };
  const statusColors: Record<BusinessStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    received: 'bg-emerald-50 text-emerald-700',
  };

  const formatAccount = (name: string | null, bank: string | null, number: string | null) => {
    if (!name) return 'ไม่ระบุบัญชี';
    const parts = [name];
    if (bank) parts.push(bank);
    if (number) parts.push(`เลขบัญชี: ${number}`);
    return parts.join(' • ');
  };

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
                  value={formatAccount(transaction.sourceAccountName, transaction.sourceAccountBank, transaction.sourceAccountNumber)}
                  icon="📤"
                />
                <DetailRow
                  label="ไปยังบัญชี"
                  value={formatAccount(transaction.destinationAccountName, transaction.destinationAccountBank, transaction.destinationAccountNumber)}
                  icon="📥"
                />
              </>
            )}
            {transaction.type === 'income' && (
              <DetailRow
                label="เข้าบัญชี"
                value={formatAccount(transaction.destinationAccountName, transaction.destinationAccountBank, transaction.destinationAccountNumber)}
                icon="📥"
              />
            )}
            {transaction.type === 'expense' && (
              <DetailRow
                label="จากบัญชี"
                value={formatAccount(transaction.sourceAccountName, transaction.sourceAccountBank, transaction.sourceAccountNumber)}
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
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4 pb-6">
          <button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-slate-100 font-semibold text-slate-700">ปิด</button>
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