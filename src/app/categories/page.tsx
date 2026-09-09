'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Pencil, Plus, Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategoryIcon } from '@/components/category-icon';
import { IconPicker } from '@/components/icon-picker';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';

type Category = { id: string; name: string; type: 'income' | 'expense'; icon: string | null; color: string | null; isActive: boolean };
type CategoryForm = { name: string; type: 'income' | 'expense'; icon: string; color: string; isActive: boolean };

const emptyForm: CategoryForm = { name: '', type: 'income', icon: 'ReceiptText', color: '#10b981', isActive: true };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ count: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

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
    setShowIconPicker(false);
    setIsFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({ name: category.name, type: category.type, icon: category.icon || 'ReceiptText', color: category.color || '#10b981', isActive: category.isActive });
    setErrorMessage(null);
    setShowIconPicker(false);
    setIsFormOpen(true);
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    const response = await fetch(editingId ? `/api/categories/${editingId}` : '/api/categories', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, icon: form.icon || null, color: form.color || null }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setErrorMessage(payload.error || 'ไม่สามารถบันทึกข้อมูลได้');
      showToast('ไม่สามารถบันทึกข้อมูลได้', 'error');
      return;
    }

    showToast(editingId ? 'แก้ไขหมวดหมู่สำเร็จ' : 'เพิ่มหมวดหมู่สำเร็จ', 'success');
    await loadData();
    setIsFormOpen(false);
  };

  // เช็คการใช้งานก่อนแสดง dialog
  const handleDeleteClick = async (category: Category) => {
    setIsChecking(true);
    
    const response = await fetch(`/api/categories/${category.id}/usage`);
    const data = (await response.json()) as { count: number };
    
    setIsChecking(false);
    
    if (data.count > 0) {
      setDeleteWarning({ count: data.count });
    } else {
      setDeleteWarning(null);
    }
    setDeleteTarget(category);
  };

  const deactivateCategory = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const response = await fetch(`/api/categories/${deleteTarget.id}`, { method: 'DELETE' });
    setIsDeleting(false);
    setDeleteTarget(null);
    setDeleteWarning(null);

    if (!response.ok) {
      showToast('ไม่สามารถลบข้อมูลได้', 'error');
      return;
    }

    showToast('ลบหมวดหมู่สำเร็จ', 'success');
    await loadData();
  };

  return (
    <main className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Master Data</p>
            <h1 className="mt-1 text-[1.65rem] font-bold tracking-tight text-slate-900">หมวดหมู่</h1>
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
            <article key={category.id} className="overflow-hidden rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color || '#10b981'}22`, color: category.color || '#10b981' }}>
                    <CategoryIcon name={category.icon} size={20} />
                  </span>
                  <div className="min-w-0 overflow-hidden">
                    <h2 className="truncate font-semibold text-slate-900">{category.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">{category.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</p>
                    {!category.isActive && <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">ปิดใช้งาน</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(category)} aria-label={`แก้ไข ${category.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Pencil size={18} aria-hidden="true" /></button>
                  <button type="button" onClick={() => void handleDeleteClick(category)} disabled={isChecking} aria-label={`ลบ ${category.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 disabled:opacity-50">
                    {isChecking ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteWarning(null); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-40px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            {deleteWarning ? (
              <>
                <Dialog.Title className="text-lg font-bold text-slate-900">⚠️ หมวดหมู่นี้ถูกใช้งานใน {deleteWarning.count} รายการ</Dialog.Title>
                <Dialog.Description className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>หากลบ:</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>รายการเดิมจะยังอยู่</li>
                    <li>หมวดหมู่ในประวัติรายการจะไม่แสดงชื่ออีกต่อไป</li>
                  </ul>
                </Dialog.Description>
                <p className="mt-4 font-medium text-slate-900">ต้องการลบหรือไม่?</p>
              </>
            ) : (
              <>
                <Dialog.Title className="text-lg font-bold text-slate-900">ลบหมวดหมู่</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-600">ต้องการลบหมวดหมู่นี้หรือไม่?</Dialog.Description>
              </>
            )}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteWarning(null); }} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700" disabled={isDeleting}>
                ยกเลิก
              </button>
              <button type="button" onClick={deactivateCategory} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 font-semibold text-white" disabled={isDeleting}>
                {isDeleting ? <><Loader2 size={16} className="animate-spin" /> กำลังลบ...</> : 'ลบ'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Create / Edit Form Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5" onClick={() => setIsFormOpen(false)}>
          <form onClick={(event) => event.stopPropagation()} onSubmit={saveCategory} className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} aria-label="ปิดฟอร์ม" className="grid min-h-10 min-w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <label className="block text-sm font-medium text-slate-700">
                ชื่อหมวดหมู่
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base" />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  ประเภท
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as 'income' | 'expense' })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base">
                    <option value="income">รายรับ</option>
                    <option value="expense">รายจ่าย</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  สถานะ
                  <select value={String(form.isActive)} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'true' })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base">
                    <option value="true">ใช้งาน</option>
                    <option value="false">ปิดใช้งาน</option>
                  </select>
                </label>
              </div>

              {/* Icon & Color Row */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="block text-sm font-medium text-slate-700">
                  ไอคอน
                  <div className="mt-2">
                    {showIconPicker ? (
                      <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} onClose={() => setShowIconPicker(false)} />
                    ) : (
                      <button type="button" onClick={() => setShowIconPicker(true)} className="flex h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 shadow-sm ring-1 ring-slate-200">
                          <CategoryIcon name={form.icon} size={18} />
                        </span>
                        <span className="flex-1 text-left text-base text-slate-500">เลือกไอคอน</span>
                      </button>
                    )}
                  </div>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  สี
                  <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-2" />
                </label>
              </div>

              {errorMessage && <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}

              <button type="submit" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50" disabled={isSaving}>
                {isSaving ? <><Loader2 size={18} className="animate-spin" /> {editingId ? 'กำลังบันทึก...' : 'กำลังเพิ่มหมวดหมู่...'}</> : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}
      <MobileNav />
    </main>
  );
}
