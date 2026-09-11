'use client';

import { ArrowLeftRight, LayoutDashboard, Menu, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
  { href: '/transactions', label: 'รายการ', icon: ArrowLeftRight },
  { href: '/accounts', label: 'บัญชี', icon: WalletCards },
  { href: '/more', label: 'เพิ่มเติม', icon: Menu },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(31,42,68,0.08)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid h-[4.5rem] max-w-md grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/more' ? pathname.startsWith('/more') || pathname === '/persons' || pathname === '/properties' || pathname === '/categories' || pathname === '/settings' : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`relative flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                active ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {active && <span className="absolute top-1 h-1 w-7 rounded-full bg-emerald-600" />}
              <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}