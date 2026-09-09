'use client';

import { Building2, Pencil, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';

type Person = { id: string; name: string };
type Property = { id: string; name: string; ownerPersonId: string; ownerName: string; status: 'active' | 'inactive' };
type PropertyForm = { name: string; ownerPersonId: string; status: 'active' | 'inactive' };

const emptyForm: PropertyForm = { name: '', ownerPersonId: '', status: 'active' };

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { showToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    const [propertiesResponse, peopleResponse] = await Promise.all([fetch('/api/properties'), fetch('/api/persons')]);
    if (!propertiesResponse.ok || !peopleResponse.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    setProperties(await propertiesResponse.json());
    setPeople(await peopleResponse.json());
  };

  useEffect(() => {
    loadData().catch((error) => setErrorMessage(error.message)).finally(() => setIsLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, ownerPersonId: people[0]?.id || '' });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (property: Property) => {
    setEditingId(property.id);
    setForm({ name: property.name, ownerPersonId: property.ownerPersonId, status: property.status });
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const saveProperty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    const response = await fetch(editingId ? `/api/properties/${editingId}` : '/api/properties', {
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
    await loadData();
    setIsFormOpen(false);
  };

  const deleteProperty = async (id: string) => {
    if (!window.confirm('ต้องการลบทรัพย์สินนี้หรือไม่')) return;
    setIsDeleting(id);
    const response = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    setIsDeleting(null);
    if (!response.ok) {
      showToast('ไม่สามารถลบข้อมูลได้', 'error');
      return;
    }
    showToast('ลบข้อมูลสำเร็จ', 'success');
    await loadData();
  };

  return (
    <main className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">ทรัพย์สินในครอบครัว</p>
            <h1 className="mt-1 text-[1.65rem] font-bold tracking-tight text-slate-900">ทรัพย์สิน</h1>
          </div>
          <button type="button" onClick={openCreate} disabled={people.length === 0} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={18} aria-hidden="true" /> เพิ่ม
          </button>
        </div>
      </header>

      <section className="space-y-3 px-5 py-5">
        {errorMessage && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>}
        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center">
            <Building2 className="mx-auto text-slate-400" size={30} aria-hidden="true" />
            <p className="mt-3 font-medium text-slate-700">ยังไม่มีทรัพย์สิน</p>
            <p className="mt-1 text-sm text-slate-500">ต้องเพิ่มบุคคลก่อนจึงจะสร้างทรัพย์สินได้</p>
          </div>
        ) : (
          properties.map((property) => (
            <article key={property.id} className="overflow-hidden rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 overflow-hidden">
                  <h2 className="truncate font-semibold text-slate-900">{property.name}</h2>
                  <p className="mt-1 truncate text-sm text-slate-500">เจ้าของ: {property.ownerName}</p>
                  <span className={`mt-3 inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold ${property.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {property.status === 'active' ? 'ใช้งานอยู่' : 'ไม่ใช้งาน'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(property)} aria-label={`แก้ไข ${property.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Pencil size={18} aria-hidden="true" /></button>
                  <button type="button" onClick={() => deleteProperty(property.id)} disabled={isDeleting === property.id} aria-label={`ลบ ${property.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 disabled:opacity-50">
                    {isDeleting === property.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-slate-950/30 sm:items-center sm:justify-center sm:p-5" onClick={() => setIsFormOpen(false)}>
          <form onClick={(event) => event.stopPropagation()} onSubmit={saveProperty} className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'แก้ไขทรัพย์สิน' : 'เพิ่มทรัพย์สิน'}</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} aria-label="ปิดฟอร์ม" className="grid min-h-10 min-w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <label className="block text-sm font-medium text-slate-700">ชื่อทรัพย์สิน<input required disabled={isSaving} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-emerald-600" /></label>
              <label className="mt-4 block text-sm font-medium text-slate-700">เจ้าของ<select required disabled={isSaving} value={form.ownerPersonId} onChange={(event) => setForm({ ...form, ownerPersonId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="">เลือกเจ้าของ</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label className="mt-4 block text-sm font-medium text-slate-700">สถานะ<select disabled={isSaving} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"><option value="active">ใช้งานอยู่</option><option value="inactive">ไม่ใช้งาน</option></select></label>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSaving} className="h-12 w-full rounded-xl border border-slate-200 font-semibold text-slate-700 disabled:opacity-50">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50">
                  {isSaving ? <><Loader2 size={18} className="animate-spin" /> {editingId ? 'กำลังบันทึก...' : 'กำลังเพิ่มทรัพย์สิน...'}</> : 'บันทึก'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      <MobileNav />
    </main>
  );
}