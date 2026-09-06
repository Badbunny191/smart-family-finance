'use client';

import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';

type Person = {
  id: string;
  name: string;
  isDaughter: boolean;
};

const emptyForm = { name: '', isDaughter: false };

export default function PersonsPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPeople = async () => {
    const response = await fetch('/api/persons');
    if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    setPeople(await response.json());
  };

  useEffect(() => {
    loadPeople().catch((error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditingId(person.id);
    setForm({ name: person.name, isDaughter: person.isDaughter });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const savePerson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const response = await fetch(editingId ? `/api/persons/${editingId}` : '/api/persons', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setErrorMessage(payload.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    await loadPeople();
    setIsFormOpen(false);
  };

  const deletePerson = async (id: string) => {
    if (!window.confirm('ต้องการลบบุคคลนี้หรือไม่')) return;
    const response = await fetch(`/api/persons/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setErrorMessage('ลบข้อมูลไม่สำเร็จ');
      return;
    }
    await loadPeople();
  };

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">จัดการข้อมูลครอบครัว</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">บุคคล</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            <Plus size={18} aria-hidden="true" /> เพิ่มบุคคล
          </button>
        </div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}
        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center">
            <Users className="mx-auto text-slate-400" size={30} aria-hidden="true" />
            <p className="mt-3 font-medium text-slate-700">ยังไม่มีข้อมูลบุคคล</p>
            <p className="mt-1 text-sm text-slate-500">เพิ่มบุคคลแรกเพื่อใช้เชื่อมกับทรัพย์สินและบัญชี</p>
          </div>
        ) : (
          people.map((person) => (
            <article key={person.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{person.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{person.isDaughter ? 'บุตรสาว' : 'สมาชิกครอบครัว'}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(person)} aria-label={`แก้ไข ${person.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => deletePerson(person.id)} aria-label={`ลบ ${person.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600">
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
          <form onSubmit={savePerson} className="w-full rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'แก้ไขบุคคล' : 'เพิ่มบุคคล'}</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} className="min-h-11 px-2 text-sm text-slate-500">ยกเลิก</button>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              ชื่อบุคคล
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-emerald-600" />
            </label>
            <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.isDaughter} onChange={(event) => setForm({ ...form, isDaughter: event.target.checked })} className="h-5 w-5 accent-emerald-600" />
              เป็นบุตรสาว
            </label>
            <button type="submit" className="mt-6 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white">บันทึก</button>
          </form>
        </div>
      )}
      <MobileNav />
    </main>
  );
}