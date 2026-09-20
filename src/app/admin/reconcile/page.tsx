'use client';

import { useState, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { MobileNav } from '@/components/mobile-nav';
import { useSession } from '@/lib/auth-client';
import { formatAccountDisplayName, formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high';

interface ReconcileAccountRow {
  accountId: string;
  accountName: string;
  accountAlias: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountType: 'bank' | 'cash';
  openingBalance: number;
  storedBalance: number;
  expectedBalance: number;
  discrepancy: number;
  severity: Severity;
}

interface ReconcileReport {
  accounts: ReconcileAccountRow[];
  hasDiscrepancy: boolean;
  totalAccounts: number;
  mismatchCount: number;
}

type PossibleCauseCode =
  | 'pending_inconsistency'
  | 'historical_bug'
  | 'deleted_tx_inconsistency'
  | 'adjustment_inconsistency'
  | 'unknown';

interface CauseEvidence {
  code: PossibleCauseCode;
  description: string;
  relatedTransactionIds?: string[];
}

interface RepairPreview {
  oldBalance: number;
  newBalance: number;
  discrepancy: number;
}

interface AnalysisResult {
  account: ReconcileAccountRow;
  possibleCauses: CauseEvidence[];
  needsRepair: boolean;
  repairPreview: RepairPreview | null;
}

interface TxRow {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  date: number;
  title: string;
  status: 'pending' | 'completed' | 'cancelled';
  businessStatus?: 'pending' | 'received' | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  adjustmentDirection?: 'increase' | 'decrease' | null;
  note?: string | null;
  createdAt: number;
  deletedAt: number | null;
}

interface RepairResult {
  accountId: string;
  accountAlias: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountType: 'bank' | 'cash';
  accountName: string;
  oldBalance: number;
  newBalance: number;
  discrepancy: number;
  repaired: boolean;
  repairedAt?: string;
  logId?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(n);

const severityConfig: Record<
  Severity,
  { label: string; color: string; bg: string; border: string; badge: string }
> = {
  low: {
    label: 'ต่ำ',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-600',
  },
  medium: {
    label: 'ปานกลาง',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  high: {
    label: 'สูง',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
};

const causeLabel: Record<PossibleCauseCode, string> = {
  pending_inconsistency: '📋 รายการรอดำเนินการ',
  historical_bug: '🐛 บั๊กระบบก่อนหน้า',
  deleted_tx_inconsistency: '🗑️ รายการที่ถูกลบ',
  adjustment_inconsistency: '⚙️ การปรับยอดไม่สมดุล',
  unknown: '❓ ไม่ทราบสาเหตุ',
};

const txTypeLabel: Record<string, { label: string; color: string }> = {
  income: { label: 'รายรับ', color: 'text-emerald-600' },
  expense: { label: 'รายจ่าย', color: 'text-red-600' },
  transfer: { label: 'โอน', color: 'text-blue-600' },
  adjustment: { label: 'ปรับยอด', color: 'text-purple-600' },
};

const statusLabel: Record<string, string> = {
  completed: '✓',
  pending: 'รอ',
  cancelled: 'ยกเลิก',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, badge } = severityConfig[severity];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}
    >
      {label}
    </span>
  );
}

function TxRow({ tx, accountId }: { tx: TxRow; accountId: string }) {
  const [open, setOpen] = useState(false);
  const date = new Date(tx.date);
  const isDeleted = tx.deletedAt !== null;

  const direction =
    tx.type === 'income'
      ? '→ เข้า'
      : tx.type === 'expense'
        ? '← ออก'
        : tx.type === 'transfer'
          ? tx.sourceAccountId === accountId
            ? '→ ออก'
            : '← เข้า'
          : tx.adjustmentDirection === 'increase'
            ? '→ +'
            : '← -';

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        isDeleted
          ? 'border-dashed border-red-300 bg-red-50/40 opacity-70'
          : tx.status === 'pending'
            ? 'border-amber-200 bg-amber-50/40'
            : 'border-slate-200 bg-white'
      }`}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span
              className={`truncate font-medium ${txTypeLabel[tx.type]?.color ?? 'text-slate-700'}`}
            >
              {txTypeLabel[tx.type]?.label ?? tx.type}
            </span>
            <span className="text-slate-400 text-xs">{direction}</span>
            {isDeleted && (
              <span className="flex items-center gap-0.5 text-xs text-red-500">
                <Trash2 size={11} /> ลบแล้ว
              </span>
            )}
            {tx.status === 'pending' && (
              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-700">
                รอดำเนินการ
              </span>
            )}
          </div>
          <span className="shrink-0 font-semibold text-slate-800">
            {fmt(tx.amount)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-slate-500 truncate ml-5">{tx.title}</span>
          <span className="text-xs text-slate-400 shrink-0 ml-2">
            {formatDate(date)}
          </span>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600 pl-5">
          <p>
            <span className="text-slate-400">ID:</span>{' '}
            <span className="font-mono text-slate-500">{tx.id.slice(0, 8)}…</span>
          </p>
          <p>
            <span className="text-slate-400">สถานะ:</span> {statusLabel[tx.status] ?? tx.status}
          </p>
          {tx.businessStatus && (
            <p>
              <span className="text-slate-400">Business:</span> {tx.businessStatus}
            </p>
          )}
          {tx.adjustmentDirection && (
            <p>
              <span className="text-slate-400">ทิศทาง:</span>{' '}
              {tx.adjustmentDirection === 'increase' ? 'เพิ่ม (+) ' : 'ลด (-)'}
            </p>
          )}
          {tx.note && (
            <p>
              <span className="text-slate-400">หมายเหตุ:</span> {tx.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminReconcilePage() {
  const { data: session, isPending: sessionPending } = useSession();
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected account for drill-down
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showTxList, setShowTxList] = useState(false);

  // Repair modal
  const [repairConfirm, setRepairConfirm] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);

  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/admin/reconcile');
      const data = (await res.json()) as ReconcileReport & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? 'เกิดข้อผิดพลาด');
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccountDetail = useCallback(
    async (accountId: string) => {
      setLoadingDetail(true);
      setAnalysis(null);
      setTxs([]);
      setShowTxList(false);
      try {
        const [analysisRes, txRes] = await Promise.all([
          fetch(`/api/admin/reconcile/accounts/${accountId}/analysis`),
          fetch(`/api/admin/reconcile/accounts/${accountId}/transactions`),
        ]);

        const analysisData =
          (await analysisRes.json()) as AnalysisResult & { error?: string };
        const txData = (await txRes.json()) as {
          transactions: TxRow[];
          error?: string;
        };

        if (!analysisRes.ok) throw new Error(analysisData?.error);
        if (!txRes.ok) throw new Error(txData?.error);

        setAnalysis(analysisData);
        setTxs(txData.transactions);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'โหลดรายละเอียดล้มเหลว');
      } finally {
        setLoadingDetail(false);
      }
    },
    []
  );

  const handleSelectAccount = useCallback(
    async (accountId: string) => {
      setSelectedId(accountId);
      setShowTxList(false);
      setRepairConfirm(false);
      setRepairResult(null);
      await loadAccountDetail(accountId);
    },
    [loadAccountDetail]
  );

  const handleRepair = useCallback(async () => {
    if (!selectedId || !analysis) return;
    setRepairing(true);
    setRepairResult(null);
    try {
      const res = await fetch(
        `/api/admin/reconcile/accounts/${selectedId}/repair`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirm: true,
            expectedExpectedBalance: analysis.account.expectedBalance,
          }),
        }
      );
      const data = (await res.json()) as RepairResult & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? 'เกิดข้อผิดพลาด');
      setRepairResult(data);
      // Refresh report
      await loadReport();
      // Refresh detail
      await loadAccountDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ซ่อมยอดล้มเหลว');
    } finally {
      setRepairing(false);
      setRepairConfirm(false);
    }
  }, [selectedId, analysis, loadReport, loadAccountDetail]);

  if (sessionPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="app-shell min-h-screen pb-24 md:pb-0">
        <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6">
          <Link
            href="/more"
            className="touch-button inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
          >
            <ArrowLeft size={18} /> กลับ
          </Link>
        </header>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <ShieldAlert size={48} className="text-red-400" />
          <h2 className="text-xl font-bold text-slate-800">
            ต้องเป็น Admin เท่านั้น
          </h2>
          <p className="text-sm text-slate-500">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </p>
        </div>
        <MobileNav />
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6">
        <Link
          href="/more"
          className="touch-button inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={18} /> กลับ
        </Link>
        <h1 className="mt-4 text-[1.65rem] font-bold tracking-tight text-slate-900">
          ตรวจสอบยอดบัญชี
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          เปรียบเทียบยอดในระบบ (stored) กับยอดคาดหวัง (จาก transaction history)
        </p>
      </header>

      <div className="px-5 py-5 space-y-4">
        {/* Refresh */}
        <div className="surface-card px-5 py-5">
          <button
            onClick={loadReport}
            disabled={loading}
            className="w-full touch-button flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> กำลังโหลด...</>
            ) : (
              <><RefreshCw size={18} /> รีเฟรชรายงาน</>
            )}
          </button>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Summary */}
          {report && (
            <div
              className={`mt-4 rounded-xl border p-4 ${
                report.hasDiscrepancy
                  ? 'border-red-200 bg-red-50'
                  : 'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {report.hasDiscrepancy ? (
                  <AlertTriangle className="text-red-600" size={22} />
                ) : (
                  <CheckCircle2 className="text-green-600" size={22} />
                )}
                <span
                  className={`font-bold ${
                    report.hasDiscrepancy ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {report.hasDiscrepancy
                    ? `พบยอดไม่ตรง ${report.mismatchCount} บัญชี`
                    : 'ยอดบัญชีทุกบัญชีถูกต้อง ✓'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                ตรวจสอบทั้งหมด {report.totalAccounts} บัญชี
              </p>
            </div>
          )}

          {/* Account list */}
          {report && report.accounts.length > 0 && (
            <div className="mt-4 space-y-2">
              {report.accounts.map((acc) => {
                const { bg, border } = severityConfig[acc.severity];
                const isMismatch = Math.abs(acc.discrepancy) > 0.01;
                return (
                  <button
                    key={acc.accountId}
                    type="button"
                    onClick={() =>
                      isMismatch
                        ? handleSelectAccount(acc.accountId)
                        : undefined
                    }
                    className={`w-full rounded-xl border p-4 text-left transition-all ${bg} ${border} ${
                      isMismatch ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'
                    } ${selectedId === acc.accountId ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {formatAccountDisplayName({
                            accountType: acc.accountType,
                            accountAlias: acc.accountAlias,
                            bankName: acc.bankName,
                            accountNumber: acc.accountNumber,
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          เริ่มต้น: {fmt(acc.openingBalance)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {isMismatch ? (
                          <>
                            <SeverityBadge severity={acc.severity} />
                            <p className="mt-1 text-xs font-semibold text-red-600">
                              {acc.discrepancy > 0 ? '+' : ''}
                              {fmt(acc.discrepancy)}
                            </p>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 size={13} /> ตรงกัน
                          </span>
                        )}
                      </div>
                    </div>
                    {isMismatch && (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          ยอดในระบบ: {fmt(acc.storedBalance)}
                        </span>
                        <span className="text-slate-500">
                          คาดหวัง: {fmt(acc.expectedBalance)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Account Detail Panel ── */}
        {selectedId && (
          <div className="surface-card px-5 py-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                {analysis?.account
                  ? formatAccountDisplayName({
                      accountType: analysis.account.accountType,
                      accountAlias: analysis.account.accountAlias,
                      bankName: analysis.account.bankName,
                      accountNumber: analysis.account.accountNumber,
                    })
                  : 'กำลังโหลด...'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setAnalysis(null);
                  setShowTxList(false);
                  setRepairConfirm(false);
                }}
                className="touch-button rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-slate-400" size={28} />
              </div>
            ) : analysis ? (
              <div className="mt-4 space-y-4">
                {/* Balance Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-slate-500">ยอดในระบบ</p>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {fmt(analysis.account.storedBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">ยอดคาดหวัง</p>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {fmt(analysis.account.expectedBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">ส่วนต่าง</p>
                      <p
                        className={`mt-0.5 font-bold ${
                          Math.abs(analysis.account.discrepancy) > 0.01
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {analysis.account.discrepancy > 0 ? '+' : ''}
                        {fmt(analysis.account.discrepancy)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Possible Causes */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    Possible Causes (สาเหตุที่เป็นไปได้)
                  </h3>
                  {analysis.possibleCauses.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      ไม่พบสาเหตุที่ชัดเจน
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {analysis.possibleCauses.map((cause, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                        >
                          <span className="shrink-0 text-base">
                            {causeLabel[cause.code] ?? cause.code}
                          </span>
                          <p className="text-slate-700">{cause.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transaction List Toggle */}
                <button
                  type="button"
                  onClick={() => setShowTxList((v) => !v)}
                  className="w-full touch-button flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>
                    รายการธุรกรรม ({txs.length})
                  </span>
                  <ChevronRight
                    size={16}
                    className={`transition-transform ${showTxList ? 'rotate-90' : ''}`}
                  />
                </button>

                {showTxList && (
                  <div className="space-y-2">
                    {txs.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">
                        ไม่พบรายการ
                      </p>
                    ) : (
                      txs.map((tx) => (
                        <TxRow key={tx.id} tx={tx} accountId={selectedId} />
                      ))
                    )}
                  </div>
                )}

                {/* Repair Section */}
                {analysis.needsRepair && !repairResult && (
                  <div className="space-y-3 pt-2">
                    <div className="border-t border-slate-200" />
                    <button
                      type="button"
                      onClick={() => setRepairConfirm(true)}
                      className="w-full touch-button flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700"
                    >
                      <Wrench size={16} />
                      🔧 ซ่อมยอดให้ตรง
                    </button>
                  </div>
                )}

                {/* Repair Confirmation */}
                {repairConfirm && analysis.repairPreview && (
                  <div className="space-y-3 rounded-xl border-2 border-red-300 bg-red-50 p-4">
                    <p className="font-bold text-red-800">ยืนยันการซ่อมยอด</p>
                    <div className="space-y-1 text-sm text-slate-700">
                      <p>
                        <span className="font-medium">บัญชี:</span>{' '}
                        {formatAccountDisplayName({
                          accountType: analysis.account.accountType,
                          accountAlias: analysis.account.accountAlias,
                          bankName: analysis.account.bankName,
                          accountNumber: analysis.account.accountNumber,
                        })}
                      </p>
                      <p>
                        <span className="font-medium">ยอดเดิม:</span>{' '}
                        {fmt(analysis.repairPreview.oldBalance)}
                      </p>
                      <p>
                        <span className="font-medium">ยอดใหม่:</span>{' '}
                        {fmt(analysis.repairPreview.newBalance)}
                      </p>
                      <p>
                        <span className="font-medium">ส่วนต่าง:</span>{' '}
                        {fmt(analysis.repairPreview.discrepancy)}
                      </p>
                    </div>
                    <p className="text-xs text-red-600">
                      การดำเนินการนี้จะบันทึกลง Audit Log และเปลี่ยนยอดในระบบทันที
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleRepair}
                        disabled={repairing}
                        className="flex-1 touch-button rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {repairing ? (
                          <Loader2 size={15} className="animate-spin mx-auto" />
                        ) : (
                          'ยืนยัน'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepairConfirm(false)}
                        disabled={repairing}
                        className="flex-1 touch-button rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}

                {/* Repair Result */}
                {repairResult && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                    <CheckCircle2
                      size={36}
                      className="mx-auto text-green-600"
                    />
                    <p className="mt-2 font-bold text-green-800">
                      ซ่อมยอดสำเร็จ
                    </p>
                    <p className="mt-1 text-sm text-green-700">
                      {fmt(repairResult.oldBalance)} →{' '}
                      {fmt(repairResult.newBalance)}
                    </p>
                    {repairResult.logId && (
                      <p className="mt-1 text-xs text-green-600 font-mono">
                        Log ID: {repairResult.logId.slice(0, 8)}…
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MobileNav />
    </main>
  );
}
