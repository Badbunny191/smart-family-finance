'use client';

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-center"><div><h1 className="text-lg font-bold text-slate-900">โหลด Dashboard ไม่สำเร็จ</h1><p className="mt-2 text-sm text-slate-500">ตรวจสอบการเชื่อมต่อฐานข้อมูลแล้วลองใหม่</p><button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white">ลองใหม่</button></div></main>;
}