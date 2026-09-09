import { MobileNav } from '@/components/mobile-nav';

export default function DashboardLoading() {
  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="border-b border-slate-200/70 bg-white px-5 pb-6 pt-7">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div className="animate-pulse">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-56 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-44 rounded bg-slate-200" />
          </div>
          <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-6">
        <div className="animate-pulse space-y-5">
          <div className="h-32 rounded-2xl bg-slate-200" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
          </div>
          <div className="h-36 rounded-2xl bg-slate-200" />
        </div>
      </div>

      <MobileNav />
    </main>
  );
}
