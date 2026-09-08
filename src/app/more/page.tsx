import { ChevronRight, FolderCog, Settings, Tags, Users, Building2 } from 'lucide-react';
import Link from 'next/link';
import { MobileNav } from '@/components/mobile-nav';

const items = [
  { href: '/persons', label: 'บุคคล', description: 'เจ้าของบัญชีและค่าใช้จ่าย', icon: Users },
  { href: '/properties', label: 'ทรัพย์สิน', description: 'จัดกลุ่มค่าใช้จ่าย', icon: Building2 },
  { href: '/categories', label: 'หมวดหมู่', description: 'รายรับและรายจ่าย', icon: Tags },
  { href: '/settings', label: 'การตั้งค่า', description: 'การตั้งค่าระบบ', icon: Settings },
];

export default function MorePage() {
  return <main className="app-shell min-h-screen pb-24"><header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6"><p className="section-label">การจัดการระบบ</p><h1 className="mt-2 text-[1.65rem] font-bold tracking-tight text-slate-900">เพิ่มเติม</h1></header><section className="space-y-3 px-5 py-5">{items.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className="surface-card flex min-h-16 items-center gap-4 p-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span><ChevronRight className="text-slate-400" size={20} /></Link>)}</section><MobileNav /></main>;
}