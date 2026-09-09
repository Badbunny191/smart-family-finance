import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { MobileNav } from '@/components/mobile-nav';

export default function SettingsPage() {
  return <main className="app-shell min-h-screen pb-24 md:pb-0"><header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6"><Link href="/more" className="touch-button inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={18} /> กลับ</Link><h1 className="mt-4 text-[1.65rem] font-bold tracking-tight text-slate-900">การตั้งค่า</h1></header><section className="px-5 py-5"><div className="surface-card px-5 py-10 text-center"><Settings className="mx-auto text-slate-400" size={28} /><p className="mt-3 font-semibold text-slate-800">การตั้งค่าระบบ</p><p className="mt-1 text-sm text-slate-500">ส่วนนี้จะพร้อมใช้งานในระยะถัดไป</p></div></section><MobileNav /></main>;
}