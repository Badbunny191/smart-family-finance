'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';

type Category = { id: string; name: string; type: 'income' | 'expense'; icon: string | null; color: string | null; isActive: boolean; };
type CategoryForm = { name: string; type: 'income' | 'expense'; icon: string; color: string; isActive: boolean; };

const emptyForm: CategoryForm = { name: '', type: 'income', icon: '💰', color: '#10b981', isActive: true };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    const response = await fetch('/api/categories');
    if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    setCategories(await response.json());
  };

  useEffect(() => {
    loadData().catch((error: Error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({ name: category.name, type: category.type, icon: category.icon || '💰', color: category.color || '#10b981', isActive: category.isActive });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const response = await fetch(editingId ? `/api/categories/${editingId}` : '/api/categories', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, icon: form.icon || null, color: form.color || null }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setErrorMessage(payload.error || 'บันทึกไม่สำเร็จ');
      return;
    }

    await loadData();
    setIsFormOpen(false);
  };

  const deactivateCategory = async (id: string) => {
    if (!window.confirm('ต้องการปิดใช้งานหมวดหมู่นี้หรือไม่')) return;
    const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setErrorMessage('ปิดใช้งานไม่สำเร็จ');
      return;
    }

    await loadData();
  };

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Master Data</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">หมวดหมู่</h1>
          </div>
          <button type="button" onClick={openCreate} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm">
            <Plus size={18} aria-hidden="true" /> เพิ่ม
          </button>
        </div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}
        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center">
            <p className="mt-3 font-medium text-slate-700">ยังไม่มีหมวดหมู่</p>
          </div>
        ) : (
          categories.map((category) => (
            <article key={category.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl text-lg" style={{ backgroundColor: `${category.color || '#10b981'}22`, color: category.color || '#10b981' }}>
                    {category.icon || '💰'}
                  </span>
                  <div>
                    <h2 className="font-semibold text-slate-900">{category.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">{category.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</p>
                    {!category.isActive && <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">ปิดใช้งาน</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(category)} aria-label={`แก้ไข ${category.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Pencil size={18} aria-hidden="true" /></button>
                  <button type="button" onClick={() => deactivateCategory(category.id)} aria-label={`ปิดใช้งาน ${category.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={18} aria-hidden="true" /></button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5">
          <form onSubmit={saveCategory} className="w-full rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{editingId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</h2><button type="button" onClick={() => setIsFormOpen(false)} className="min-h-11 px-2 text-sm text-slate-500">ยกเลิก</button></div>
            <label className="block text-sm font-medium text-slate-700">ชื่อหมวดหมู่<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base" /></label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">ประเภท<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as 'income' | 'expense' })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="income">รายรับ</option><option value="expense">รายจ่าย</option></select></label>
              <label className="block text-sm font-medium text-slate-700">สถานะ<select value={String(form.isActive)} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'true' })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="true">ใช้งาน</option><option value="false">ปิดใช้งาน</option></select></label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">ไอคอน<input value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value.slice(0, 2) || '💰' })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base" /></label>
              <label className="block text-sm font-medium text-slate-700">สี<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-2" /></label>
            </div>
            <button type="submit" className="mt-6 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white">บันทึก</button>
          </form>
        </div>
      )}
      <MobileNav />
    </main>
  );
}
