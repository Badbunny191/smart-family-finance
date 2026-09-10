'use client';

import { ArrowLeft, Pencil, Plus, Trash2, Users, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';

type Person = {
  id: string;
  name: string;
  isDaughter: boolean;
};

type PersonUsage = {
  accountCount: number;
  propertyCount: number;
};

const emptyForm = { name: '', isDaughter: false };

export default function PersonsPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<PersonUsage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { showToast } = useToast();
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
    setIsSaving(true);
    const response = await fetch(editingId ? `/api/persons/${editingId}` : '/api/persons', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setIsSaving(false);
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      showToast(payload.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      return;
    }
    showToast(editingId ? 'บันทึกข้อมูลสำเร็จ' : 'เพิ่มข้อมูลสำเร็จ', 'success');
    await loadPeople();
    setIsFormOpen(false);
  };

  const deletePerson = async (id: string) => {
    setIsDeleting(true);
    const response = await fetch(`/api/persons/${id}`, { method: 'DELETE' });
    setIsDeleting(false);
    if (!response.ok) {
      showToast('ไม่สามารถลบข้อมูลได้', 'error');
      return;
    }
    showToast('ลบข้อมูลสำเร็จ', 'success');
    await loadPeople();
  };

  const handleDeleteClick = async (person: Person) => {
    setIsChecking(true);
    const response = await fetch(`/api/persons/${person.id}/usage`);
    const data = (await response.json()) as PersonUsage;
    setIsChecking(false);
    if (data.accountCount > 0 || data.propertyCount > 0) {
      setDeleteWarning(data);
    } else {
      setDeleteWarning(null);
    }
    setDeleteTarget(person);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deletePerson(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteWarning(null);
  };

  return (
    <main className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <Link href="/more" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <ArrowLeft size={18} /> กลับ
        </Link>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">จัดการข้อมูลครอบครัว</p>
            <h1 className="mt-1 text-[1.65rem] font-bold tracking-tight text-slate-900">บุคคล</h1>
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
            <article key={person.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 overflow-hidden">
                  <h2 className="truncate font-semibold text-slate-900">{person.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{person.isDaughter ? 'บุตรสาว' : 'สมาชิกครอบครัว'}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(person)} aria-label={`แก้ไข ${person.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => void handleDeleteClick(person)} disabled={isChecking} aria-label={`ลบ ${person.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 disabled:opacity-50">
                    {isChecking ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5" onClick={() => setIsFormOpen(false)}>
          <form onClick={(event) => event.stopPropagation()} onSubmit={savePerson} className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'แก้ไขบุคคล' : 'เพิ่มบุคคล'}</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} aria-label="ปิดฟอร์ม" className="grid min-h-10 min-w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <label className="block text-sm font-medium text-slate-700">
                ชื่อบุคคล
                <input required disabled={isSaving} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-emerald-600" />
              </label>
              <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700">
                <input type="checkbox" disabled={isSaving} checked={form.isDaughter} onChange={(event) => setForm({ ...form, isDaughter: event.target.checked })} className="h-5 w-5 accent-emerald-600" />
                เป็นบุตรสาว
              </label>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSaving} className="h-12 w-full rounded-xl border border-slate-200 font-semibold text-slate-700 disabled:opacity-50">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50">
                  {isSaving ? <><Loader2 size={18} className="animate-spin" /> {editingId ? 'กำลังบันทึก...' : 'กำลังเพิ่มบุคคล...'}</> : 'บันทึก'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteWarning(null); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-40px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            {deleteWarning ? (
              <>
                <Dialog.Title className="text-lg font-bold text-slate-900">⚠️ บุคคลนี้ถูกใช้งานอยู่</Dialog.Title>
                <Dialog.Description className="mt-3 space-y-1 text-sm text-slate-600">
                  <p>บัญชี: {deleteWarning.accountCount} รายการ</p>
                  <p>ทรัพย์สิน: {deleteWarning.propertyCount} รายการ</p>
                </Dialog.Description>
                <p className="mt-4 font-medium text-rose-600">ไม่สามารถลบได้จนกว่าจะย้ายหรือลบข้อมูลที่เกี่ยวข้อง</p>
              </>
            ) : (
              <>
                <Dialog.Title className="text-lg font-bold text-slate-900">ลบบุคคล</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-600">ต้องการลบบุคคลนี้หรือไม่?</Dialog.Description>
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