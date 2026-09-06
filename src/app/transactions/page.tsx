'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';

type TransactionType = 'income' | 'expense' | 'transfer';
type Person = { id: string; name: string };
type Property = { id: string; name: string };
type Account = { id: string; name: string; personName: string; currentBalance: number };
type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  title: string;
  ownerPersonId: string;
  payerPersonId: string;
  propertyId: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  note: string | null;
};

type FormState = {
  type: TransactionType;
  amount: string;
  date: string;
  title: string;
  ownerPersonId: string;
  payerPersonId: string;
  propertyId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm: FormState = { type: 'expense', amount: '', date: today(), title: '', ownerPersonId: '', payerPersonId: '', propertyId: '', sourceAccountId: '', destinationAccountId: '', note: '' };

const typeOptions: { value: TransactionType; label: string; icon: typeof ArrowDownLeft }[] = [
  { value: 'income', label: 'รายรับ', icon: ArrowDownLeft },
  { value: 'expense', label: 'รายจ่าย', icon: ArrowUpRight },
  { value: 'transfer', label: 'โอนเงิน', icon: ArrowLeftRight },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    const responses = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/persons'),
      fetch('/api/properties'),
      fetch('/api/accounts'),
    ]);
    if (responses.some((response) => !response.ok)) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    setTransactions(await responses[0].json());
    setPeople(await responses[1].json());
    setProperties(await responses[2].json());
    setAccounts(await responses[3].json());
  };

  useEffect(() => {
    loadData().catch((error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, []);

  const openCreate = (type: TransactionType = 'expense') => {
    setForm({ ...emptyForm, type, date: today(), ownerPersonId: people[0]?.id || '', payerPersonId: people[0]?.id || '' });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        date: new Date(`${form.date}T00:00:00`).toISOString(),
        propertyId: form.propertyId || null,
        sourceAccountId: form.sourceAccountId || null,
        destinationAccountId: form.destinationAccountId || null,
        note: form.note || null,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setErrorMessage(payload.error || 'บันทึกรายการไม่สำเร็จ');
      return;
    }
    await loadData();
    setIsFormOpen(false);
  };

  const deleteTransaction = async (id: string) => {
    if (!window.confirm('ต้องการลบรายการนี้หรือไม่ ยอดบัญชีจะถูกย้อนกลับ')) return;
    const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setErrorMessage(payload.error || 'ลบรายการไม่สำเร็จ');
      return;
    }
    await loadData();
  };

  const personName = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);
  const propertyName = useMemo(() => new Map(properties.map((property) => [property.id, property.name])), [properties]);
  const accountName = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-sm text-slate-500">เงินเข้า เงินออก และการโอน</p><h1 className="mt-1 text-2xl font-bold text-slate-900">รายการเงิน</h1></div>
          <button type="button" onClick={() => openCreate()} disabled={people.length === 0 || accounts.length === 0} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50" aria-label="เพิ่มรายการ"><Plus size={20} aria-hidden="true" /></button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
          {typeOptions.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => openCreate(value)} className={`flex min-h-11 items-center justify-center gap-1 rounded-xl text-xs font-semibold ${form.type === value && isFormOpen ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p> : transactions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center"><ArrowLeftRight className="mx-auto text-slate-400" size={30} aria-hidden="true" /><p className="mt-3 font-medium text-slate-700">ยังไม่มีรายการเงิน</p><p className="mt-1 text-sm text-slate-500">เพิ่มรายรับ รายจ่าย หรือรายการโอนได้จากปุ่มด้านบน</p></div> : transactions.map((transaction) => <article key={transaction.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`grid min-h-9 min-w-9 place-items-center rounded-xl ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-700' : transaction.type === 'expense' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>{transaction.type === 'income' ? <ArrowDownLeft size={18} /> : transaction.type === 'expense' ? <ArrowUpRight size={18} /> : <ArrowLeftRight size={18} />}</span><div><h2 className="truncate font-semibold text-slate-900">{transaction.title}</h2><p className="text-xs text-slate-500">{new Date(transaction.date).toLocaleDateString('th-TH')}</p></div></div><p className={`mt-3 text-xl font-bold ${transaction.type === 'expense' ? 'text-rose-700' : 'text-emerald-700'}`}>{transaction.type === 'expense' ? '-' : '+'}{transaction.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p><p className="mt-1 text-xs text-slate-500">{personName.get(transaction.ownerPersonId) || 'ไม่ระบุ'} · {transaction.type === 'transfer' ? `${accountName.get(transaction.sourceAccountId || '') || '-'} → ${accountName.get(transaction.destinationAccountId || '') || '-'}` : accountName.get(transaction.sourceAccountId || transaction.destinationAccountId || '') || 'ไม่ระบุบัญชี'}</p>{transaction.propertyId && <p className="mt-1 text-xs text-slate-500">ทรัพย์สิน: {propertyName.get(transaction.propertyId) || '-'}</p>}</div><button type="button" onClick={() => deleteTransaction(transaction.id)} aria-label={`ลบ ${transaction.title}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={18} aria-hidden="true" /></button></div></article>)}
      </section>

      {isFormOpen && <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5"><form onSubmit={saveTransaction} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:max-w-md sm:rounded-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{form.type === 'income' ? 'เพิ่มรายรับ' : form.type === 'expense' ? 'เพิ่มรายจ่าย' : 'เพิ่มรายการโอน'}</h2><button type="button" onClick={() => setIsFormOpen(false)} className="min-h-11 px-2 text-sm text-slate-500">ยกเลิก</button></div><label className="block text-sm font-medium text-slate-700">หัวข้อ<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-emerald-600" /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">จำนวนเงิน<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-base" /></label><label className="text-sm font-medium text-slate-700">วันที่<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-base" /></label></div><label className="mt-4 block text-sm font-medium text-slate-700">ผู้รับผิดชอบ<select required value={form.ownerPersonId} onChange={(event) => setForm({ ...form, ownerPersonId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">เลือกบุคคล</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="mt-4 block text-sm font-medium text-slate-700">ผู้จ่าย / คู่รายการ<select required value={form.payerPersonId} onChange={(event) => setForm({ ...form, payerPersonId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">เลือกบุคคล</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>{form.type !== 'transfer' ? <label className="mt-4 block text-sm font-medium text-slate-700">บัญชี{form.type === 'income' ? 'ปลายทาง' : 'ต้นทาง'}<select required value={form.type === 'income' ? form.destinationAccountId : form.sourceAccountId} onChange={(event) => setForm({ ...form, ...(form.type === 'income' ? { destinationAccountId: event.target.value } : { sourceAccountId: event.target.value }) })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">เลือกบัญชี</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currentBalance.toLocaleString('th-TH')} บาท</option>)}</select></label> : <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">จาก<select required value={form.sourceAccountId} onChange={(event) => setForm({ ...form, sourceAccountId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm"><option value="">เลือกบัญชี</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">ไปยัง<select required value={form.destinationAccountId} onChange={(event) => setForm({ ...form, destinationAccountId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm"><option value="">เลือกบัญชี</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div>}<label className="mt-4 block text-sm font-medium text-slate-700">ทรัพย์สิน (ไม่บังคับ)<select value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">ไม่ผูกกับทรัพย์สิน</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label className="mt-4 block text-sm font-medium text-slate-700">หมายเหตุ<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base" /></label><button type="submit" className="mt-6 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white">บันทึกรายการ</button></form></div>}
      <MobileNav />
    </main>
  );
}