'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await signIn.email({
        email,
        password,
      });

      if (res.error) {
        setErrorMessage(res.error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setErrorMessage('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
  <div className="text-2xl">💰</div>
</div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Smart Family Finance
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          เข้าสู่ระบบบริหารการเงินครอบครัว
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              อีเมล
            </label>
            <div className="mt-1">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="daughter@family.internal"
                className="block h-12 w-full rounded-xl border border-slate-200 px-4 text-base placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              รหัสผ่าน
            </label>
            <div className="mt-1">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block h-12 w-full rounded-xl border border-slate-200 px-4 text-base placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}