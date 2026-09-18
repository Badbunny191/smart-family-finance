'use client';

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-6">
      {/* SECTION 1: สินทรัพย์รวม */}
      <section>
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="surface-card block overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
              <div className="mt-3 h-9 w-36 animate-pulse rounded bg-white/20" />
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
              <div className="h-6 w-6 animate-pulse rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: ดูรายการ */}
      <section>
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-3 gap-3">
          <div className="surface-card block p-4">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-emerald-200" />
            </div>
            <div className="mx-auto mt-2 h-3 w-12 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="surface-card block p-4">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-rose-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-rose-200" />
            </div>
            <div className="mx-auto mt-2 h-3 w-12 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="surface-card block p-4">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-indigo-200" />
            </div>
            <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </section>

      {/* SECTION 3: บัญชีธุรกิจ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-2">
          <div className="surface-card overflow-hidden">
            <div className="flex min-h-[56px] items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50">
                  <div className="h-4 w-4 animate-pulse rounded bg-emerald-200" />
                </div>
                <div>
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-12 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                <div className="grid h-6 w-6 shrink-0 place-items-center">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="flex min-h-[56px] items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50">
                  <div className="h-4 w-4 animate-pulse rounded bg-emerald-200" />
                </div>
                <div>
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-12 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
                <div className="grid h-6 w-6 shrink-0 place-items-center">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: บัญชีส่วนตัว */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-2">
          <div className="surface-card overflow-hidden">
            <div className="flex min-h-[56px] items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50">
                  <div className="h-4 w-4 animate-pulse rounded bg-indigo-200" />
                </div>
                <div>
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-12 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                <div className="grid h-6 w-6 shrink-0 place-items-center">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="flex min-h-[56px] items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50">
                  <div className="h-4 w-4 animate-pulse rounded bg-indigo-200" />
                </div>
                <div>
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-12 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
                <div className="grid h-6 w-6 shrink-0 place-items-center">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="flex min-h-[56px] items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50">
                  <div className="h-4 w-4 animate-pulse rounded bg-indigo-200" />
                </div>
                <div>
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-12 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                <div className="grid h-6 w-6 shrink-0 place-items-center">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: กระแสเงินสดเดือนนี้ */}
      <section>
        <div className="mb-3 h-4 w-36 animate-pulse rounded bg-slate-200" />
        <div className="surface-card block overflow-hidden bg-emerald-600 p-5">
          <div className="h-3 w-20 animate-pulse rounded bg-white/30" />
          <div className="mx-auto mt-2 h-8 w-28 animate-pulse rounded bg-white/30" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="surface-card block overflow-hidden p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50">
                <div className="h-4 w-4 animate-pulse rounded bg-emerald-200" />
              </div>
              <div className="min-w-0">
                <div className="h-2 w-10 animate-pulse rounded bg-slate-200" />
                <div className="mt-1 h-4 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
          <div className="surface-card block overflow-hidden p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-50">
                <div className="h-4 w-4 animate-pulse rounded bg-rose-200" />
              </div>
              <div className="min-w-0">
                <div className="h-2 w-10 animate-pulse rounded bg-slate-200" />
                <div className="mt-1 h-4 w-14 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: รายการล่าสุด */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="surface-card flex items-start gap-3 overflow-hidden p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-emerald-200" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
          <div className="surface-card flex items-start gap-3 overflow-hidden p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-rose-200" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-16 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
          <div className="surface-card flex items-start gap-3 overflow-hidden p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-indigo-200" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
          <div className="surface-card flex items-start gap-3 overflow-hidden p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50">
              <div className="h-5 w-5 animate-pulse rounded-full bg-emerald-200" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
