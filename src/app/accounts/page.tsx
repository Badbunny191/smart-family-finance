'use client';

import { Banknote, Pencil, Plus, Search, Trash2, WalletCards, X, Loader2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';

type Person = { id: string; name: string };
type Property = { id: string; name: string };
type Account = { id: string; name: string; accountAlias: string | null; bankName: string | null; accountNumber: string | null; personId: string; personName: string; propertyId: string | null; propertyName: string | null; accountType: 'bank' | 'cash'; isBusinessAccount: boolean; openingBalance: number; currentBalance: number };
type AccountForm = { name: string; accountAlias: string; bankName: string; accountNumber: string; personId: string; propertyId: string; accountType: 'bank' | 'cash'; isBusinessAccount: boolean; openingBalance: string; currentBalance: string };
type AccountUsage = { transactionCount: number };
const emptyForm: AccountForm = { name: '', accountAlias: '', bankName: '', accountNumber: '', personId: '', propertyId: '', accountType: 'bank', isBusinessAccount: false, openingBalance: '0', currentBalance: '0' };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<AccountUsage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { showToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => { 
    const [accountResponse, personResponse, propertyResponse] = await Promise.all([fetch('/api/accounts'), fetch('/api/persons'), fetch('/api/properties')]); 
    if (!accountResponse.ok || !personResponse.ok || !propertyResponse.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ'); 
    setAccounts(await accountResponse.json()); 
    setPeople(await personResponse.json()); 
    setProperties(await propertyResponse.json()); 
  };

  useEffect(() => { 
    loadData().catch((error: Error) => setErrorMessage(error.message)).finally(() => setIsLoading(false)); 
  }, []);

  const openCreate = () => { 
    setEditingId(null); 
    setForm({ ...emptyForm, personId: people[0]?.id || '' }); 
    setErrorMessage(null); 
    setIsFormOpen(true); 
  };

  const openEdit = (account: Account) => { 
    setEditingId(account.id); 
    setForm({ 
      name: account.name, 
      accountAlias: account.accountAlias || '', 
      bankName: account.bankName || '', 
      accountNumber: account.accountNumber || '', 
      personId: account.personId, 
      propertyId: account.propertyId || '', 
      accountType: account.accountType, 
      isBusinessAccount: account.isBusinessAccount, 
      openingBalance: String(account.openingBalance), 
      currentBalance: String(account.currentBalance) 
    }); 
    setErrorMessage(null); 
    setIsFormOpen(true); 
  };

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    const response = await fetch(editingId ? `/api/accounts/${editingId}` : '/api/accounts', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        accountAlias: form.accountAlias || null,
        bankName: form.bankName || null,
        accountNumber: form.accountNumber || null,
        propertyId: form.propertyId || null,
        isBusinessAccount: form.isBusinessAccount,
        openingBalance: Number(form.openingBalance),
        currentBalance: Number(form.currentBalance)
      })
    });
    setIsSaving(false);
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      showToast(payload.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      return;
    }
    showToast(editingId ? 'บันทึกข้อมูลสำเร็จ' : 'เพิ่มข้อมูลสำเร็จ', 'success');
    await loadData();
    setIsFormOpen(false);
  };

  const deleteAccount = async (id: string) => {
    setIsDeleting(true);
    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    setIsDeleting(false);
    if (!response.ok) {
      showToast('ไม่สามารถลบข้อมูลได้', 'error');
      return;
    }
    showToast('ลบข้อมูลสำเร็จ', 'success');
    await loadData();
  };

  const handleDeleteClick = async (account: Account) => {
    setIsChecking(true);
    const response = await fetch(`/api/accounts/${account.id}/usage`);
    const data = (await response.json()) as AccountUsage;
    setIsChecking(false);
    if (data.transactionCount > 0) {
      setDeleteWarning(data);
    } else {
      setDeleteWarning(null);
    }
    setDeleteTarget(account);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteAccount(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteWarning(null);
  };

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-5 pb-5 pt-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-label">แหล่งเงินของครอบครัว</p>
            <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">บัญชี</h1>
          </div>
          <button type="button" onClick={openCreate} disabled={people.length === 0} className="touch-button flex items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(22,134,107,0.2)] disabled:opacity-50">
            <Plus size={18} /> เพิ่ม
          </button>
        </div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}
        {!isLoading && accounts.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="🔍 ค้นหาบัญชี..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-600"
            />
          </div>
        )}
        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : accounts.length === 0 ? (
          <div className="surface-card border-dashed px-5 py-12 text-center">
            <WalletCards className="mx-auto text-slate-400" size={30} />
            <p className="mt-3 font-medium text-slate-700">ยังไม่มีบัญชี</p>
            <p className="mt-1 text-sm text-slate-500">เพิ่มบุคคลก่อนเพื่อสร้างบัญชีแรก</p>
          </div>
        ) : (() => {
          const normalizedSearch = searchQuery.trim().toLowerCase();
          const filteredAccounts = normalizedSearch === ''
            ? accounts
            : accounts.filter((account) => {
                const haystack = `${account.name} ${account.accountAlias ?? ''} ${account.bankName ?? ''} ${account.accountNumber ?? ''}`.toLowerCase();
                return haystack.includes(normalizedSearch);
              });
          if (filteredAccounts.length === 0) {
            return (
              <div className="surface-card border-dashed px-5 py-12 text-center">
                <p className="font-medium text-slate-700">ไม่พบบัญชีที่ค้นหา</p>
                <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหา</p>
              </div>
            );
          }
          return filteredAccounts.map((account) => (
            <article key={account.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${account.accountType === 'bank' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-700'}`}>
                      {account.accountType === 'bank' ? <WalletCards size={21} /> : <Banknote size={21} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-semibold text-slate-900">{account.accountAlias || account.name}</h2>
                        {account.isBusinessAccount ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">ธุรกิจ</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">ส่วนตัว</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{account.bankName || (account.accountType === 'bank' ? 'ธนาคาร' : 'เงินสด')}</p>
                    </div>
                  </div>
                  {account.accountNumber && <p className="mt-3 truncate text-xs text-slate-500">เลขบัญชี {account.accountNumber}</p>}
                  <p className="mt-2 truncate text-xs text-slate-500">เจ้าของบัญชี: {account.personName}</p>
                  <p className="mt-5 truncate text-2xl font-bold tracking-tight text-slate-900">{account.currentBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span className="text-sm font-medium text-slate-500">บาท</span></p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(account)} aria-label={`แก้ไข ${account.accountAlias || account.name}`} className="touch-button grid min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Pencil size={18} />
                  </button>
                  <button type="button" onClick={() => void handleDeleteClick(account)} disabled={isChecking} aria-label={`ลบ ${account.accountAlias || account.name}`} className="touch-button grid min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 disabled:opacity-50">
                    {isChecking ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              </div>
            </article>
          ));
        })()}
      </section>

      {isFormOpen && (
        <AccountFormDialog
          form={form}
          setForm={setForm}
          people={people}
          editing={Boolean(editingId)}
          onClose={() => setIsFormOpen(false)}
          onSubmit={saveAccount}
          isSaving={isSaving}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteWarning(null); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-40px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            {deleteWarning ? (
              <>
                <Dialog.Title className="text-lg font-bold text-slate-900">⚠️ บัญชีนี้ถูกใช้งานอยู่ใน {deleteWarning.transactionCount} รายการทางการเงิน</Dialog.Title>
                <Dialog.Description className="mt-3 text-sm text-slate-600">
                  <p>ไม่สามารถลบได้</p>
                </Dialog.Description>
              </>
            ) : (
              <>
                <Dialog.Title className="text-lg font-bold text-slate-900">ลบบัญชี</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-600">ต้องการลบบัญชีนี้หรือไม่?</Dialog.Description>
              </>
            )}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteWarning(null); }} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700" disabled={isDeleting}>
                ยกเลิก
              </button>
              <button type="button" onClick={confirmDelete} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 font-semibold text-white" disabled={isDeleting || !!deleteWarning}>
                {isDeleting ? <><Loader2 size={16} className="animate-spin" /> กำลังลบ...</> : 'ลบ'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <MobileNav />
    </main>
  );
}

function AccountFormDialog({ form, setForm, people, editing, onClose, onSubmit, isSaving }: { form: AccountForm; setForm: (form: AccountForm) => void; people: Person[]; editing: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>; isSaving: boolean }) {
  const update = (values: Partial<AccountForm>) => setForm({ ...form, ...values });

  const handleAccountTypeChange = (type: 'bank' | 'cash') => {
    if (type === 'cash') {
      setForm({ ...form, accountType: type, accountNumber: '' });
    } else {
      setForm({ ...form, accountType: type });
    }
  }; 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:p-4">
      <form 
        onSubmit={onSubmit} 
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-100"
      >
        {/* Header: Grid 3 ช่อง หัวข้ออยู่ตรงกลางจริง ปุ่ม X ขวาสุด */}
        <header className="shrink-0 grid grid-cols-[40px_1fr_40px] items-center border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 sm:pt-5 backdrop-blur-md">
          <div />
          <h2 className="text-center text-lg font-bold text-slate-900">
            {editing ? 'แก้ไขบัญชี' : 'เพิ่มบัญชี'}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            aria-label="ปิดฟอร์ม" 
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content: ส่วนเดียวที่เลื่อนดูข้อมูลได้ */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
          <Label text="ชื่อที่แสดง">
            <input required value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder="เช่น กรรณจมณ, เงินสดร้าน" className="form-input" />
          </Label>
          
          <fieldset className="pt-1">
            <legend className="mb-2 text-sm font-medium text-slate-700">ประเภทบัญชี</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['bank', 'cash'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAccountTypeChange(type)}
                  className={`touch-button rounded-xl border py-2.5 text-sm font-semibold transition-all ${form.accountType === type ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {type === 'bank' ? '🏦 ธนาคาร' : '💵 เงินสด'}
                </button>
              ))}
            </div>
          </fieldset>

          {form.accountType === 'bank' && (
            <>
              <Label text="ชื่อธนาคาร">
                <input value={form.bankName} onChange={(event) => update({ bankName: event.target.value })} placeholder="เช่น กรุงเทพ, กสิกรไทย" className="form-input" />
              </Label>
              <Label text="เลขบัญชี (ไม่บังคับ)">
                <input
                  value={form.accountNumber}
                  onChange={(event) => update({ accountNumber: event.target.value })}
                  placeholder="123-4-56789-0"
                  className="form-input"
                />
              </Label>
            </>
          )}

          <Label text="เจ้าของ">
            <select required value={form.personId} onChange={(event) => update({ personId: event.target.value })} className="form-input">
              <option value="">เลือกบุคคล</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </Label>

          <fieldset className="pt-1">
            <legend className="mb-2 text-sm font-medium text-slate-700">ประเภทการใช้งาน</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update({ isBusinessAccount: false })}
                className={`touch-button rounded-xl border py-2.5 text-sm font-semibold transition-all ${form.isBusinessAccount === false ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                👤 ส่วนตัว
              </button>
              <button
                type="button"
                onClick={() => update({ isBusinessAccount: true })}
                className={`touch-button rounded-xl border py-2.5 text-sm font-semibold transition-all ${form.isBusinessAccount === true ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🏢 ธุรกิจ
              </button>
            </div>
          </fieldset>

          {editing ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Label text="ยอดเริ่มต้น">
                <input type="number" step="0.01" value={form.openingBalance} onChange={(event) => update({ openingBalance: event.target.value })} className="form-input" />
              </Label>
              <div>
                <label className="block text-sm font-medium text-slate-700">ยอดปัจจุบัน</label>
                <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                  {Number(form.currentBalance).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </div>
                <p className="mt-1.5 text-xs text-slate-500">คำนวณอัตโนมัติจากรายการรายรับ รายจ่าย และการโอนเงิน</p>
              </div>
            </div>
          ) : (
            <div className="pt-1">
              <Label text="ยอดเริ่มต้น">
                <input type="number" step="0.01" value={form.openingBalance} onChange={(event) => update({ openingBalance: event.target.value })} className="form-input" />
              </Label>
            </div>
          )}
        </div>

        {/* Footer: ตรึงติดขอบล่างเสมอ มีระยะปลอดภัย */}
        <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-8 sm:pb-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSaving}
              className="h-12 w-full rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {isSaving ? <><Loader2 size={18} className="animate-spin" /> {editing ? 'กำลังบันทึก...' : 'กำลังเพิ่มบัญชี...'}</> : 'บันทึก'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  ); 
}

function Label({ text, children }: { text: string; children: React.ReactNode }) { 
  return <label className="block text-sm font-medium text-slate-700">{text}{children}</label>; 
}