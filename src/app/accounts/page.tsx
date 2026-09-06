'use client';

import { Pencil, Plus, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';

type Person = { id: string; name: string };
type Property = { id: string; name: string };
type Account = { id: string; name: string; personId: string; personName: string; propertyId: string | null; propertyName: string | null; accountType: 'bank' | 'cash'; openingBalance: number; currentBalance: number };
type AccountForm = { name: string; personId: string; propertyId: string; accountType: 'bank' | 'cash'; openingBalance: string; currentBalance: string };

const emptyForm: AccountForm = { name: '', personId: '', propertyId: '', accountType: 'bank', openingBalance: '0', currentBalance: '0' };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    const [accountsResponse, peopleResponse, propertiesResponse] = await Promise.all([fetch('/api/accounts'), fetch('/api/persons'), fetch('/api/properties')]);
    if (!accountsResponse.ok || !peopleResponse.ok || !propertiesResponse.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    setAccounts(await accountsResponse.json());
    setPeople(await peopleResponse.json());
    setProperties(await propertiesResponse.json());
  };

  useEffect(() => {
    loadData().catch((error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, personId: people[0]?.id || '' });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingId(account.id);
    setForm({ name: account.name, personId: account.personId, propertyId: account.propertyId || '', accountType: account.accountType, openingBalance: String(account.openingBalance), currentBalance: String(account.currentBalance) });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const response = await fetch(editingId ? `/api/accounts/${editingId}` : '/api/accounts', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, propertyId: form.propertyId || null, openingBalance: Number(form.openingBalance), currentBalance: Number(form.currentBalance) }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setErrorMessage(payload.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    await loadData();
    setIsFormOpen(false);
  };

  const deleteAccount = async (id: string) => {
    if (!window.confirm('ต้องการลบบัญชีนี้หรือไม่')) return;
    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setErrorMessage('ลบข้อมูลไม่สำเร็จ');
      return;
    }
    await loadData();
  };

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4"><div><p className="text-sm text-slate-500">แหล่งเงินของครอบครัว</p><h1 className="mt-1 text-2xl font-bold text-slate-900">บัญชี</h1></div><button type="button" onClick={openCreate} disabled={people.length === 0} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Plus size={18} aria-hidden="true" /> เพิ่ม</button></div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p> : accounts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center"><WalletCards className="mx-auto text-slate-400" size={30} aria-hidden="true" /><p className="mt-3 font-medium text-slate-700">ยังไม่มีบัญชี</p><p className="mt-1 text-sm text-slate-500">เพิ่มบุคคลก่อนเพื่อสร้างบัญชีแรก</p></div> : accounts.map((account) => <article key={account.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{account.name}</h2><p className="mt-1 text-sm text-slate-500">{account.accountType === 'bank' ? 'ธนาคาร' : 'เงินสด'} · {account.personName}</p><p className="mt-3 text-xl font-bold text-emerald-700">{account.currentBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p>{account.propertyName && <p className="mt-1 text-xs text-slate-500">ผูกกับ: {account.propertyName}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => openEdit(account)} aria-label={`แก้ไข ${account.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Pencil size={18} aria-hidden="true" /></button><button type="button" onClick={() => deleteAccount(account.id)} aria-label={`ลบ ${account.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={18} aria-hidden="true" /></button></div></div></article>)}
      </section>

      {isFormOpen && <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5"><form onSubmit={saveAccount} className="w-full rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:max-w-md sm:rounded-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{editingId ? 'แก้ไขบัญชี' : 'เพิ่มบัญชี'}</h2><button type="button" onClick={() => setIsFormOpen(false)} className="min-h-11 px-2 text-sm text-slate-500">ยกเลิก</button></div><label className="block text-sm font-medium text-slate-700">ชื่อบัญชี<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-emerald-600" /></label><label className="mt-4 block text-sm font-medium text-slate-700">เจ้าของ<select required value={form.personId} onChange={(event) => setForm({ ...form, personId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">เลือกบุคคล</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="mt-4 block text-sm font-medium text-slate-700">ทรัพย์สิน (ไม่บังคับ)<select value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">ไม่ผูกกับทรัพย์สิน</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><fieldset className="mt-4"><legend className="text-sm font-medium text-slate-700">ประเภทบัญชี</legend><div className="mt-2 grid grid-cols-2 gap-2">{(['bank', 'cash'] as const).map((type) => <button key={type} type="button" onClick={() => setForm({ ...form, accountType: type })} className={`h-12 rounded-xl border text-sm font-semibold ${form.accountType === type ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>{type === 'bank' ? 'ธนาคาร' : 'เงินสด'}</button>)}</div></fieldset><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">ยอดเริ่มต้น<input type="number" step="0.01" value={form.openingBalance} onChange={(event) => setForm({ ...form, openingBalance: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-base" /></label><label className="text-sm font-medium text-slate-700">ยอดปัจจุบัน<input type="number" step="0.01" value={form.currentBalance} onChange={(event) => setForm({ ...form, currentBalance: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-base" /></label></div><button type="submit" className="mt-6 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white">บันทึก</button></form></div>}
      <MobileNav />
    </main>
  );
}