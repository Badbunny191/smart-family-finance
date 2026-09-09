'use client';

import { Banknote, Pencil, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';

type Person = { id: string; name: string };
type Property = { id: string; name: string };
type Account = { id: string; name: string; accountAlias: string | null; bankName: string | null; accountNumber: string | null; personId: string; personName: string; propertyId: string | null; propertyName: string | null; accountType: 'bank' | 'cash'; openingBalance: number; currentBalance: number };
type AccountForm = { name: string; accountAlias: string; bankName: string; accountNumber: string; personId: string; propertyId: string; accountType: 'bank' | 'cash'; openingBalance: string; currentBalance: string };
const emptyForm: AccountForm = { name: '', accountAlias: '', bankName: '', accountNumber: '', personId: '', propertyId: '', accountType: 'bank', openingBalance: '0', currentBalance: '0' };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadData = async () => { const [accountResponse, personResponse, propertyResponse] = await Promise.all([fetch('/api/accounts'), fetch('/api/persons'), fetch('/api/properties')]); if (!accountResponse.ok || !personResponse.ok || !propertyResponse.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ'); setAccounts(await accountResponse.json()); setPeople(await personResponse.json()); setProperties(await propertyResponse.json()); };
  useEffect(() => { loadData().catch((error: Error) => setErrorMessage(error.message)).finally(() => setIsLoading(false)); }, []);
  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm, personId: people[0]?.id || '' }); setErrorMessage(null); setIsFormOpen(true); };
  const openEdit = (account: Account) => { setEditingId(account.id); setForm({ name: account.name, accountAlias: account.accountAlias || '', bankName: account.bankName || '', accountNumber: account.accountNumber || '', personId: account.personId, propertyId: account.propertyId || '', accountType: account.accountType, openingBalance: String(account.openingBalance), currentBalance: String(account.currentBalance) }); setErrorMessage(null); setIsFormOpen(true); };
  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setErrorMessage(null); const response = await fetch(editingId ? `/api/accounts/${editingId}` : '/api/accounts', { method: editingId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, accountAlias: form.accountAlias || null, bankName: form.bankName || null, accountNumber: form.accountNumber || null, propertyId: form.propertyId || null, openingBalance: Number(form.openingBalance), currentBalance: Number(form.currentBalance) }) }); const payload = (await response.json()) as { error?: string }; if (!response.ok) return setErrorMessage(payload.error || 'บันทึกไม่สำเร็จ'); await loadData(); setIsFormOpen(false); };
  const deleteAccount = async (id: string) => { if (!window.confirm('ต้องการลบบัญชีนี้หรือไม่')) return; const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' }); if (!response.ok) return setErrorMessage('ลบข้อมูลไม่สำเร็จ'); await loadData(); };
  return <main className="app-shell min-h-screen pb-24"><header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-5 pb-5 pt-6 backdrop-blur-xl"><div className="flex items-center justify-between gap-4"><div><p className="section-label">แหล่งเงินของครอบครัว</p><h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">บัญชี</h1></div><button type="button" onClick={openCreate} disabled={people.length === 0} className="touch-button flex items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(22,134,107,0.2)] disabled:opacity-50"><Plus size={18} /> เพิ่ม</button></div></header><section className="space-y-3 px-5 py-5">{errorMessage && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}{isLoading ? <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p> : accounts.length === 0 ? <div className="surface-card border-dashed px-5 py-12 text-center"><WalletCards className="mx-auto text-slate-400" size={30} /><p className="mt-3 font-medium text-slate-700">ยังไม่มีบัญชี</p><p className="mt-1 text-sm text-slate-500">เพิ่มบุคคลก่อนเพื่อสร้างบัญชีแรก</p></div> : accounts.map((account) => <article key={account.id} className="surface-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${account.accountType === 'bank' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-700'}`}>{account.accountType === 'bank' ? <WalletCards size={21} /> : <Banknote size={21} />}</div><div className="min-w-0"><h2 className="truncate font-semibold text-slate-900">{account.accountAlias || account.name}</h2><p className="mt-1 text-xs text-slate-500">{account.bankName || (account.accountType === 'bank' ? 'ธนาคาร' : 'เงินสด')}</p></div></div>{account.accountNumber && <p className="mt-3 text-xs text-slate-500">เลขบัญชี {account.accountNumber}</p>}<p className="mt-2 text-xs text-slate-500">เจ้าของบัญชี: {account.personName}</p><p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{account.currentBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span className="text-sm font-medium text-slate-500">บาท</span></p></div><div className="flex gap-2"><button type="button" onClick={() => openEdit(account)} aria-label={`แก้ไข ${account.accountAlias || account.name}`} className="touch-button grid min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Pencil size={18} /></button><button type="button" onClick={() => deleteAccount(account.id)} aria-label={`ลบ ${account.accountAlias || account.name}`} className="touch-button grid min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={18} /></button></div></div></article>)}</section>{isFormOpen && <AccountFormDialog form={form} setForm={setForm} people={people} properties={properties} editing={Boolean(editingId)} onClose={() => setIsFormOpen(false)} onSubmit={saveAccount} />}<MobileNav /></main>;
}

function AccountFormDialog({ form, setForm, people, properties, editing, onClose, onSubmit }: { form: AccountForm; setForm: (form: AccountForm) => void; people: Person[]; properties: Property[]; editing: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> }) { 
  const update = (values: Partial<AccountForm>) => setForm({ ...form, ...values }); 
  return (
    <div className="fixed inset-0 z-35 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
      <form onSubmit={onSubmit} className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        
        {/* Header with Title and X Close Button */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="w-11" />
          <h2 className="text-lg font-bold text-slate-900">{editing ? 'แก้ไขบัญชี' : 'เพิ่มบัญชี'}</h2>
          <button type="button" onClick={onClose} aria-label="ปิดฟอร์ม" className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Label text="ชื่อเรียกบัญชี"><input value={form.accountAlias} onChange={(event) => update({ accountAlias: event.target.value })} className="form-input" /></Label>
          <Label text="ธนาคาร"><input value={form.bankName} onChange={(event) => update({ bankName: event.target.value })} className="form-input" /></Label>
          <Label text="เลขบัญชี"><input value={form.accountNumber} onChange={(event) => update({ accountNumber: event.target.value })} className="form-input" /></Label>
          <Label text="ชื่อบัญชี"><input required value={form.name} onChange={(event) => update({ name: event.target.value })} className="form-input" /></Label>
          <Label text="เจ้าของ"><select required value={form.personId} onChange={(event) => update({ personId: event.target.value })} className="form-input"><option value="">เลือกบุคคล</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Label>
          <Label text="ทรัพย์สิน (ไม่บังคับ)"><select value={form.propertyId} onChange={(event) => update({ propertyId: event.target.value })} className="form-input"><option value="">ไม่ผูกกับทรัพย์สิน</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></Label>
          
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">ประเภทบัญชี</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['bank', 'cash'] as const).map((type) => (
                <button key={type} type="button" onClick={() => update({ accountType: type })} className={`touch-button rounded-xl border text-sm font-semibold ${form.accountType === type ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
                  {type === 'bank' ? 'ธนาคาร' : 'เงินสด'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Label text="ยอดเริ่มต้น"><input type="number" step="0.01" value={form.openingBalance} onChange={(event) => update({ openingBalance: event.target.value })} className="form-input" /></Label>
            <Label text="ยอดปัจจุบัน"><input type="number" step="0.01" value={form.currentBalance} onChange={(event) => update({ currentBalance: event.target.value })} className="form-input" /></Label>
          </div>
        </div>

        {/* Sticky Footer with Cancel and Save Buttons */}
        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="h-12 w-full rounded-xl border border-slate-200 font-semibold text-slate-700">ยกเลิก</button>
            <button type="submit" className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white">บันทึก</button>
          </div>
        </div>

      </form>
    </div>
  ); 
}

function Label({ text, children }: { text: string; children: React.ReactNode }) { return <label className="mt-4 block text-sm font-medium text-slate-700 first:mt-0">{text}{children}</label>; }