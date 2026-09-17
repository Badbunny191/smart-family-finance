'use client';

import { toPng } from 'html-to-image';
import {
  ArrowLeft,
  Calendar,
  Download,
  Loader2,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShareableReport } from '@/components/shareable-report';
import { useToast } from '@/components/ui/toast';
import {
  buildReport,
  type Report,
  type ReportPeriod,
  type TransactionRow,
} from '@/lib/report';

const periods: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'วันนี้' },
  { value: 'week', label: 'สัปดาห์นี้' },
  { value: 'month', label: 'เดือนนี้' },
  { value: 'custom', label: 'กำหนดเอง' },
];

export default function ShareReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const formatLocalDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [customStart, setCustomStart] = useState(
    formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [customEnd, setCustomEnd] = useState(formatLocalDate(new Date()));
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const categoryIconMap = (icon: string | null | undefined) => icon ?? null;

  // Cache: fetch once
  useEffect(() => {
    const load = async () => {
      try {
        const all = await fetch('/api/transactions');
        if (!all.ok) throw new Error('ไม่สามารถโหลดข้อมูลรายการได้');
        const data = await all.json();
        // Map response to TransactionRow (it's already in the same shape)
        const rows: TransactionRow[] = (data as Array<Record<string, unknown>>).map(
          (row) => ({
            id: String(row.id),
            type: row.type as TransactionRow['type'],
            amount: Number(row.amount),
            date: String(row.date),
            title: String(row.title),
            propertyId: (row.propertyId as string | null) ?? null,
            propertyName: (row.propertyName as string | null) ?? null,
            categoryId: (row.categoryId as string | null) ?? null,
            categoryName: (row.categoryName as string | null) ?? null,
            categoryIcon: categoryIconMap(null),
          })
        );
        setTransactions(rows);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [showToast]);

  const report: Report = useMemo(() => {
    const customRange =
      period === 'custom' ? { start: customStart, end: customEnd } : undefined;
    return buildReport(transactions, period, new Date(), customRange);
  }, [transactions, period, customStart, customEnd]);

  const handleShare = useCallback(async () => {
    if (!reportRef.current) return;
    setIsCapturing(true);

    try {
      const pngDataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      // Convert dataURL to Blob
      const blob = await (await fetch(pngDataUrl)).blob();
      const file = new File([blob], `financial-report-${period}.png`, {
        type: 'image/png',
      });

      // Try native share (mobile-friendly, opens LINE on iOS/Android)
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: 'สรุปการเงิน',
          text: report.periodLabel,
        });
        showToast('แชร์สำเร็จ', 'success');
      } else {
        // Fallback: download
        const link = document.createElement('a');
        link.download = `financial-report-${period}.png`;
        link.href = pngDataUrl;
        link.click();
        showToast('ดาวน์โหลดรูปแล้ว (นำไปแชร์ LINE ได้)', 'success');
      }
    } catch (error) {
      // User cancelled share is not really an error
      if (error instanceof Error && !error.message.includes('abort')) {
        showToast('ไม่สามารถแชร์ได้', 'error');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [period, report.periodLabel, showToast]);

  const handleDownload = useCallback(async () => {
    if (!reportRef.current) return;
    setIsCapturing(true);

    try {
      const pngDataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `financial-report-${period}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = pngDataUrl;
      link.click();
      showToast('ดาวน์โหลดรูปแล้ว', 'success');
    } catch (error) {
      showToast('ไม่สามารถดาวน์โหลดได้', 'error');
    } finally {
      setIsCapturing(false);
    }
  }, [period, showToast]);

  return (
    <main className="app-shell min-h-screen pb-32 md:pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/more"
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs text-slate-500">สร้างรายงาน</p>
            <h1 className="text-lg font-bold text-slate-900">แชร์เข้า LINE</h1>
          </div>
        </div>
      </header>

      {/* Period Selector */}
      <section className="border-b border-slate-100 bg-slate-50/60 px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Calendar size={14} /> ช่วงเวลา
        </div>
        <div className="grid grid-cols-3 gap-2">
          {periods.slice(0, 3).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${
                period === p.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPeriod('custom')}
          className={`mt-2 w-full rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
            period === 'custom'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          📅 กำหนดช่วงเอง
        </button>
        {period === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">วันเริ่ม</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">วันสิ้นสุด</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {report.income.items.length} รายรับ • {report.expense.items.length} รายจ่าย
          {' • '}{report.expense.byProperty.length} กลุ่มทรัพย์สิน
        </p>
      </section>

      {/* Preview Section - Mobile-first, scrollable card preview */}
      <section className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </p>
          {isLoading && (
            <Loader2 size={14} className="animate-spin text-slate-400" />
          )}
        </div>

        {/* Preview shown at scaled-down size to fit mobile screen */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div
            style={{
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
              width: '720px',
              height: `${(reportRef.current?.scrollHeight ?? 800)}px`,
            }}
          >
            <ShareableReport report={report} />
          </div>
        </div>

        {/* Hidden full-size component for capture */}
        <div
          style={{
            position: 'fixed',
            top: '-99999px',
            left: '-99999px',
            pointerEvents: 'none',
          }}
        >
          <div ref={reportRef}>
            <ShareableReport report={report} />
          </div>
        </div>
      </section>

      {/* Action Buttons - Sticky bottom */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:bottom-0">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isCapturing || isLoading}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {isCapturing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            ดาวน์โหลด
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isCapturing || isLoading}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#06C755] font-semibold text-white transition-colors hover:bg-[#05b04c] disabled:opacity-50"
          >
            {isCapturing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            แชร์เข้า LINE
          </button>
        </div>
      </div>

      {/* Bottom safe-area placeholder so content doesn't sit under the action bar */}
      <div className="h-20 md:hidden" aria-hidden />
    </main>
  );
}
