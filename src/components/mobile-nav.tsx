'use client';

import { ArrowLeftRight, Building2, LayoutDashboard, Users, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
  { href: '/persons', label: 'บุคคล', icon: Users },
  { href: '/properties', label: 'ทรัพย์สิน', icon: Building2 },
  { href: '/accounts', label: 'บัญชี', icon: WalletCards },
  { href: '/transactions', label: 'รายการ', icon: ArrowLeftRight },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(15,23,42,0.06)] backdrop-blur sm:absolute">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                active ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}