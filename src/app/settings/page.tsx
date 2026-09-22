'use client';

import { ArrowLeft, Bell, ChevronRight, Settings as SettingsIcon, Wrench } from 'lucide-react';
import Link from 'next/link';
import { MobileNav } from '@/components/mobile-nav';

interface SettingsItem {
    href: string;
    label: string;
    description: string;
    icon: typeof Wrench;
}

const items: SettingsItem[] = [
    {
        href: '/settings/line',
        label: 'LINE Notifications',
        description: 'ตั้งค่าการแจ้งเตือนรายวันผ่าน LINE',
        icon: Bell,
    },
    {
        href: '/admin/reconcile',
        label: 'ตรวจสอบยอดบัญชี',
        description: 'ตรวจสอบ วิเคราะห์ และซ่อมยอดบัญชี',
        icon: Wrench,
    },
];

export default function SettingsPage() {
    return (
        <main className="app-shell min-h-screen pb-24 md:pb-0">
            <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6">
                <Link
                    href="/more"
                    className="touch-button inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
                >
                    <ArrowLeft size={18} /> กลับ
                </Link>
                <h1 className="mt-4 text-[1.65rem] font-bold tracking-tight text-slate-900">
                    การตั้งค่า
                </h1>
            </header>

            <section className="space-y-3 px-5 py-5">
                {items.map(({ href, label, description, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className="surface-card flex min-h-16 items-center gap-4 overflow-hidden p-4"
                    >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                            <Icon size={20} />
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="block truncate font-semibold text-slate-900">{label}</span>
                            <span className="mt-1 block truncate text-xs text-slate-500">{description}</span>
                        </span>
                        <ChevronRight className="shrink-0 text-slate-400" size={20} />
                    </Link>
                ))}

                {/* placeholder */}
                <div className="surface-card px-5 py-10 text-center">
                    <SettingsIcon className="mx-auto text-slate-400" size={28} />
                    <p className="mt-3 font-semibold text-slate-800">
                        การตั้งค่าระบบอื่นๆ
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        ส่วนนี้จะพร้อมใช้งานในระยะถัดไป
                    </p>
                </div>
            </section>

            <MobileNav />
        </main>
    );
}
