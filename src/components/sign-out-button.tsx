'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
    router.refresh();
  };
  return <button type="button" onClick={handleSignOut} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">ออกจากระบบ</button>;
}