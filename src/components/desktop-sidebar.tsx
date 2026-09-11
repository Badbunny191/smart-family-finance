'use client';

import {
  ArrowLeftRight,
  Building2,
  LayoutDashboard,
  Settings,
  Tags,
  Users,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryItems = [
  { href: '/dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
  { href: '/transactions', label: 'รายการ', icon: ArrowLeftRight },
  { href: '/accounts', label: 'บัญชี', icon: WalletCards },
];

const secondaryItems = [
  { href: '/persons', label: 'บุคคล', icon: Users },
  { href: '/properties', label: 'ทรัพย์สิน', icon: Building2 },
  { href: '/categories', label: 'หมวดหมู่', icon: Tags },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings },
];

const PUBLIC_ROUTES = ['/login'] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  if ((PUBLIC_ROUTES as readonly string[]).includes(pathname)) {
    return null;
  }

  const isActive = (href: string) =>
    href === '/more'
      ? pathname.startsWith('/more') ||
        pathname === '/persons' ||
        pathname === '/properties' ||
        pathname === '/categories' ||
        pathname === '/settings'
      : pathname === href;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white px-4 py-6 md:flex">
      <div className="px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Smart Family</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">Finance</p>
      </div>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            การจัดการระบบ
          </p>
          {secondaryItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
