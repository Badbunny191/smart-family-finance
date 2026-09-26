'use client';

/**
 * LINE Notification Settings Page — Per-Recipient Design
 *
 * Each recipient has their own settings card:
 * - enable/disable notification
 * - sendTime (Time Picker — free-form HH:mm)
 * - showBalance / showIncome / showExpense / showNet / showPending / showOverdue
 * - Preview Flex Message (Flex only — no text fallback)
 * - Test send to this specific recipient
 *
 * IMPORTANT:
 * - No time presets (drop-down removed).
 * - No text message preview (Flex Message only).
 * - All edits are LOCAL until user clicks "บันทึก".
 */

import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Layout,
  Loader2,
  Send,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';
import { effectiveSlots, prepareForSave } from '@/lib/line-multi-send-time';

export const runtime = 'nodejs';

// ============================================================
// TYPES
// ============================================================

interface DailySummarySettings {
  sendTime: string;
  additionalTimes?: string[];
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
}

interface Recipient {
  id: string;
  userId: string;
  lineUserId: string;
  displayName: string;
  notifyEnabled: boolean;  // from line_accounts.notify_enabled
  enabled: boolean;        // from notification_settings.enabled
  settings: DailySummarySettings;
}

interface LineSettingsResponse {
  success: boolean;
  bot: {
    connected: boolean;
    hasAccessToken: boolean;
    tokenVerified: boolean;
    botBasicId: string | null;
    botName: string | null;
    botDisplayName: string | null;
    botPictureUrl: string | null;
    verifyError: string | null;
  };
  recipients: Recipient[];
  recipientSummary: {
    total: number;
    enabled: number;
  };
}

interface FlexPreviewResponse {
  success: boolean;
  flexMessage: any;
  dateString: string;
  recipient: { userId: string; displayName: string; lineUserId: string };
  settings: DailySummarySettings;
}

const DEFAULT_SETTINGS: DailySummarySettings = {
  sendTime: '08:00',
  showBalance: true,
  showIncome: true,
  showExpense: true,
  showNet: true,
  showPending: true,
  showOverdue: true,
  showPendingDetails: true,
  showOverdueDetails: true,
};

type ShowKey = 'showBalance' | 'showIncome' | 'showExpense' | 'showNet' | 'showPending' | 'showOverdue' | 'showPendingDetails' | 'showOverdueDetails';

const SHOW_FIELDS: { key: ShowKey; label: string; emoji: string }[] = [
  { key: 'showBalance', label: 'ยอดคงเหลือรวม', emoji: '💰' },
  { key: 'showIncome', label: 'รายรับเดือนนี้', emoji: '📈' },
  { key: 'showExpense', label: 'รายจ่ายเดือนนี้', emoji: '📉' },
  { key: 'showNet', label: 'ยอดสุทธิ', emoji: '✅' },
  { key: 'showPending', label: 'รายการรอชำระ', emoji: '⚠️' },
  { key: 'showOverdue', label: 'รายการเกินกำหนด', emoji: '🚨' },
  { key: 'showPendingDetails', label: 'แสดงรายละเอียดรอชำระ', emoji: '📝' },
  { key: 'showOverdueDetails', label: 'แสดงรายละเอียดเกินกำหนด', emoji: '📋' },
];

// ============================================================
// MAIN PAGE
// ============================================================

export default function LineSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [bot, setBot] = useState<LineSettingsResponse['bot']>({
    connected: false,
    hasAccessToken: false,
    tokenVerified: false,
    botBasicId: null,
    botDisplayName: null,
    botName: null,
    botPictureUrl: null,
    verifyError: null,
  });
  const [recipientSummary, setRecipientSummary] = useState({ total: 0, enabled: 0 });

  // Flex Preview modal state
  const [flexPreviewModal, setFlexPreviewModal] = useState<{
    open: boolean;
    recipient: Recipient | null;
    flexMessage: any;
    loading: boolean;
  }>({ open: false, recipient: null, flexMessage: null, loading: false });

  // Expanded cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Optimistic update: sync only the saved recipient into parent state — no re-fetch
  const handleRecipientSaveSuccess = useCallback(
    (updatedRecipient: Recipient) => {
      setRecipients((prev) =>
        prev.map((r) => (r.userId === updatedRecipient.userId ? updatedRecipient : r))
      );
    },
    []
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/line');
      const json = (await res.json()) as LineSettingsResponse;
      if (json.success) {
        setRecipients(json.recipients ?? []);
        setBot(json.bot);
        setRecipientSummary(json.recipientSummary ?? { total: 0, enabled: 0 });
        // Expand all by default on mobile
        setExpandedCards(new Set(json.recipients?.map((r) => r.userId) ?? []));
      }
    } catch (err) {
      console.error(err);
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Toggle card expansion
  const toggleCard = (userId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Preview Flex Message
  const openFlexPreview = async (recipient: Recipient) => {
    setFlexPreviewModal({ open: true, recipient, flexMessage: null, loading: true });
    try {
      const res = await fetch(`/api/settings/line/flex-preview/${recipient.userId}`, {
        method: 'POST',
      });
      const json = (await res.json()) as FlexPreviewResponse;
      if (json.success && json.flexMessage) {
        setFlexPreviewModal((prev) => ({ ...prev, flexMessage: json.flexMessage, loading: false }));
      } else {
        setFlexPreviewModal((prev) => ({
          ...prev,
          flexMessage: null,
          loading: false,
        }));
      }
    } catch (err) {
      console.error('[FlexPreview fetch error]', err);
      setFlexPreviewModal((prev) => ({ ...prev, flexMessage: null, loading: false }));
    }
  };

  const closeFlexPreview = () => {
    setFlexPreviewModal({ open: false, recipient: null, flexMessage: null, loading: false });
  };

  // Test send - now sends Flex Message
  const [testingUserId, setTestingUserId] = useState<string | null>(null);
  const handleTestSend = async (recipient: Recipient) => {
    setTestingUserId(recipient.userId);
    try {
      const res = await fetch(`/api/settings/line/test/${recipient.userId}`, {
        method: 'POST',
      });
      const json = (await res.json()) as { success: boolean; messageType?: string; error?: string };
      if (json.success) {
        const msgType = json.messageType === 'flex' ? 'Flex Message' : 'ข้อความ';
        showToast(`📱 ส่ง ${msgType} ให้ ${recipient.displayName} สำเร็จ`, 'success');
      } else {
        showToast(`ส่งไม่สำเร็จ: ${json.error ?? 'ลองใหม่'}`, 'error');
      }
    } catch {
      showToast(`ส่งให้ ${recipient.displayName} ไม่สำเร็จ`, 'error');
    } finally {
      setTestingUserId(null);
    }
  };

  // ---- Render ----
  if (loading) {
    return (
      <main className="app-shell min-h-screen pb-24 md:pb-0">
        <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6">
          <Link
            href="/settings"
            className="touch-button inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
          >
            <ArrowLeft size={18} /> กลับ
          </Link>
          <h1 className="mt-4 text-[1.65rem] font-bold tracking-tight text-slate-900">
            ตั้งค่า LINE
          </h1>
        </header>
        <section className="flex justify-center px-5 py-10">
          <Loader2 className="animate-spin text-slate-400" size={28} />
        </section>
        <MobileNav />
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen pb-24 md:pb-0">
      <header className="border-b border-slate-200/70 bg-white px-5 pb-5 pt-6">
        <Link
          href="/settings"
          className="touch-button inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={18} /> กลับ
        </Link>
        <h1 className="mt-4 flex items-center gap-2 text-[1.65rem] font-bold tracking-tight text-slate-900">
          <Bell size={22} className="text-emerald-600" />
          LINE Notifications
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ตั้งค่าการแจ้งเตือนรายวัน — แต่ละคนกำหนดเองได้
        </p>
      </header>

      <div className="px-5 py-5">
        {/* Recipients section */}
        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-slate-500" />
                <h2 className="font-semibold text-slate-700">ผู้รับ</h2>
              </div>
              <span className="text-xs text-slate-500">
                {recipientSummary.enabled} เปิดใช้ / {recipientSummary.total} คน
              </span>
            </div>
          </div>

          {recipients.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              ไม่มีผู้รับ — ต้องเพิ่ม LINE User ID ก่อน
            </div>
          ) : (
            <div>
              {recipients.map((recipient) => (
                <RecipientCard
                  key={recipient.id}
                  recipient={recipient}
                  expanded={expandedCards.has(recipient.userId)}
                  onToggle={() => toggleCard(recipient.userId)}
                  onFlexPreview={() => openFlexPreview(recipient)}
                  onTestSend={() => handleTestSend(recipient)}
                  testing={testingUserId === recipient.userId}
                  onSaveSuccess={handleRecipientSaveSuccess}
                />
              ))}
            </div>
          )}
        </section>

        {/* Status section */}
        <section className="surface-card mt-4 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-slate-500" />
              <h2 className="font-semibold text-slate-700">สถานะ</h2>
            </div>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <StatusRow
              label="การเชื่อมต่อ"
              value={
                bot.connected ? (
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 size={14} /> LINE Connected
                  </span>
                ) : bot.hasAccessToken ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="text-amber-700">Token set, verification pending</span>
                    {bot.verifyError && (
                      <span className="text-xs text-slate-400">verify: {bot.verifyError}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-rose-700">Not configured</span>
                )
              }
            />
            {bot.botDisplayName && (
              <StatusRow label="Bot Name" value={bot.botDisplayName} />
            )}
          </div>
        </section>
      </div>

      <MobileNav />

      {/* Flex Message Preview Modal */}
      {flexPreviewModal.open && (
        <FlexPreviewModal
          recipient={flexPreviewModal.recipient}
          flexMessage={flexPreviewModal.flexMessage}
          loading={flexPreviewModal.loading}
          onClose={closeFlexPreview}
        />
      )}
    </main>
  );
}

// ============================================================
// RECIPIENT CARD
// ============================================================

function RecipientCard({
  recipient,
  expanded,
  onToggle,
  onFlexPreview,
  onTestSend,
  testing,
  onSaveSuccess,
}: {
  recipient: Recipient;
  expanded: boolean;
  onToggle: () => void;
  onFlexPreview: () => void;
  onTestSend: () => void;
  testing: boolean;
  onSaveSuccess: (updatedRecipient: Recipient) => void;
}) {
  const { showToast } = useToast();
  // Original (saved) settings from server — used as baseline to detect dirty state
  const [originalSettings, setOriginalSettings] = useState<DailySummarySettings>(recipient.settings);
  // Local working copy — changes here do NOT auto-save
  const [localSettings, setLocalSettings] = useState<DailySummarySettings>(recipient.settings);
  // Multi-SendTime: list of HH:mm currently edited in UI (flattened sendTime + additionalTimes)
  const [localTimes, setLocalTimes] = useState<string[]>(() =>
    effectiveSlots(recipient.settings)
  );
  const [enabled, setEnabled] = useState(recipient.enabled);
  const [saving, setSaving] = useState(false);

  // Sync when recipient prop changes (e.g. after parent reload)
  useEffect(() => {
    setLocalSettings(recipient.settings);
    setOriginalSettings(recipient.settings);
    setLocalTimes(effectiveSlots(recipient.settings));
    setEnabled(recipient.enabled);
  }, [recipient.settings, recipient.enabled]);

  // Compute dirty state: any field differs from original, OR localTimes differs
  const isDirty = (() => {
    if (enabled !== recipient.enabled) return true;
    // Compare multi-send-time arrays (both derived from settings)
    const originalTimes = effectiveSlots(originalSettings);
    if (localTimes.length !== originalTimes.length) return true;
    for (let i = 0; i < localTimes.length; i++) {
      if (localTimes[i] !== originalTimes[i]) return true;
    }
    for (const k of Object.keys(localSettings) as (keyof DailySummarySettings)[]) {
      if (k === 'additionalTimes') continue; // handled via localTimes
      if (localSettings[k] !== originalSettings[k]) return true;
    }
    return false;
  })();

  // Update field (LOCAL ONLY — no autosave)
  const updateSetting = <K extends keyof DailySummarySettings>(
    key: K,
    value: DailySummarySettings[K]
  ) => {
    console.log('[UPDATE SETTING]', {
      key,
      value
    });

    setLocalSettings((prev) => {
      const next = { ...prev, [key]: value };

      console.log('[STATE UPDATE]', {
        key,
        before: prev[key],
        after: next[key]
      });

      return next;
    });
  };

  // Multi-SendTime helpers
  const addTime = () => {
    setLocalTimes((prev) => [...prev, '08:00']);
  };
  const removeTime = (idx: number) => {
    setLocalTimes((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateTime = (idx: number, value: string) => {
    setLocalTimes((prev) => prev.map((t, i) => (i === idx ? value : t)));
  };

  // Explicit save — sends LOCAL state to server
  const handleSave = async () => {
    setSaving(true);
    try {
      // Split localTimes → sendTime + additionalTimes
      const { sendTime, additionalTimes } = prepareForSave(localTimes);
      const settingsToSave: DailySummarySettings = {
        ...localSettings,
        sendTime,
        additionalTimes,
      };
      // Build payload: include enabled if it changed, full settings (per their current state)
      const payload: { settings: DailySummarySettings; enabled?: boolean } = {
        settings: settingsToSave,
      };
      if (enabled !== recipient.enabled) {
        payload.enabled = enabled;
      }
      const res = await fetch(`/api/settings/line/recipient/${recipient.userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        // Update baseline so dirty resets to false
        setOriginalSettings(settingsToSave);
        setLocalSettings(settingsToSave);
        showToast(`บันทึกของ ${recipient.displayName} แล้ว`, 'success');

        // Sync parent state: pass only the updated recipient, parent handles array update
        onSaveSuccess({ ...recipient, settings: settingsToSave, enabled });
      } else {
        showToast(`บันทึกไม่สำเร็จ: ${json.error ?? ''}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalSettings(originalSettings);
    setLocalTimes(effectiveSlots(originalSettings));
    setEnabled(recipient.enabled);
  };

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Card Header */}
      <div className="flex cursor-pointer items-center gap-3 px-5 py-4 hover:bg-slate-50" onClick={onToggle}>
        {/* Status dot */}
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${recipient.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />

        {/* Name + lineUserId */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">
            {recipient.displayName}
          </p>
          <p className="font-mono text-xs text-slate-400">
            {recipient.lineUserId.slice(0, 14)}…
          </p>
        </div>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp size={18} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-slate-400" />
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-50 bg-white px-5 pb-4 pt-3">
          {/* Saving indicator */}
          {saving && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" /> กำลังบันทึก…
            </div>
          )}

          {/* Enabled toggle */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">เปิดใช้งาน</span>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v)}
              disabled={saving}
            />
          </div>

          {/* Send time — Multi-SendTime card list */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                เวลาแจ้งเตือน (Asia/Bangkok)
              </span>
            </div>

            {/* Card list — same layout for 1, 3, 8+ times */}
            <div className="space-y-2">
              {localTimes.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                  ยังไม่มีเวลาแจ้งเตือน — กด "เพิ่มเวลา" ด้านล่าง
                </div>
              )}
              {localTimes.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => updateTime(idx, e.target.value)}
                    disabled={!enabled || saving}
                    className="form-input flex-1 font-mono disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(idx)}
                    disabled={!enabled || saving}
                    aria-label="ลบเวลา"
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add button */}
            <button
              type="button"
              onClick={addTime}
              disabled={!enabled || saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-sky-600 hover:border-sky-400 hover:bg-sky-50 disabled:opacity-40"
            >
              <Plus size={16} />
              เพิ่มเวลา
            </button>

            <p className="text-xs text-slate-400">
              เวลาจะเรียงลำดับอัตโนมัติเมื่อบันทึก (ตามเวลาประเทศไทย)
            </p>
          </div>

          {/* Show toggles */}
          <div className="mb-4 space-y-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              เลือกข้อมูลที่จะแสดง
            </p>
            {(() => { console.log('[RENDER]', localSettings); return null; })()}
            {SHOW_FIELDS.map(({ key, label, emoji }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <span>{emoji}</span>
                  {label}
                </span>
                <Checkbox
                  checked={localSettings[key]}
                  disabled={!enabled || saving}
                  onCheckedChange={(v) => {
                    updateSetting(key, v);
                  }}
                />
              </label>
            ))}
          </div>

          {/* Dirty indicator + Save/Cancel buttons */}
          {isDirty && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              มีการเปลี่ยนแปลงยังไม่ได้บันทึก
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!isDirty || saving}
              className="touch-button flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="touch-button flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(22,134,107,0.25)] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>

          {/* Action buttons — Preview + Test Send per recipient */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onFlexPreview}
              disabled={!enabled}
              className="touch-button flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Layout size={15} />
              Flex
            </button>
            <button
              type="button"
              onClick={onTestSend}
              disabled={!enabled || testing}
              className="touch-button col-span-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {testing ? 'กำลังส่ง…' : `ส่ง Flex ให้ ${recipient.displayName.split(' ')[0]}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FLEX PREVIEW MODAL
// ============================================================

/**
 * Generic Flex Message renderer (light theme)
 * - Supports both single bubble and carousel
 * - Uses inline JSON properties (no hard-coded colors)
 */
function FlexPreviewModal({
  recipient,
  flexMessage,
  loading,
  onClose,
}: {
  recipient: Recipient | null;
  flexMessage: any;
  loading: boolean;
  onClose: () => void;
}) {
  if (!recipient) return null;

  /**
   * Render a single text node based on its JSON properties.
   */
  const renderText = (textNode: any, key: string, parentBg: string): JSX.Element => {
    const color = textNode.color || '#0F172A';
    const sizeMap: Record<string, string> = {
      xxs: 'text-[10px]',
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      xxl: 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
      '5xl': 'text-5xl',
    };
    const fontSize = sizeMap[textNode.size || 'md'] || 'text-base';
    const fontWeight = textNode.weight === 'bold' ? 'font-bold' : 'font-normal';
    const align = textNode.align === 'center' ? 'text-center' : textNode.align === 'end' ? 'text-right' : 'text-left';
    const marginClass = textNode.margin === 'md' ? 'mt-3' : textNode.margin === 'sm' ? 'mt-2' : textNode.margin === 'lg' ? 'mt-4' : '';

    return (
      <p
        key={key}
        className={`${fontSize} ${fontWeight} ${align} ${marginClass}`}
        style={{ color }}
      >
        {textNode.text}
      </p>
    );
  };

  /**
   * Render a single box container.
   * Recurses into contents (text or nested boxes or separator).
   */
  const renderBox = (box: any, key: string, depth: number): JSX.Element => {
    const isVertical = box.layout === 'vertical';
    const bg = box.backgroundColor || 'transparent';
    const radius = box.cornerRadius || '0';
    const padding = box.paddingAll || '0';
    const spacingClass =
      box.spacing === 'md' ? 'gap-3' :
      box.spacing === 'sm' ? 'gap-2' :
      box.spacing === 'lg' ? 'gap-4' : '';

    const marginClass =
      box.margin === 'md' ? 'mb-3 mt-3' :
      box.margin === 'sm' ? 'mb-2 mt-2' :
      box.margin === 'lg' ? 'mb-4 mt-4' : '';

    if (!Array.isArray(box.contents) || box.contents.length === 0) {
      return <div key={key} />;
    }

    return (
      <div
        key={key}
        className={`${marginClass} ${isVertical ? 'flex flex-col' : 'flex flex-row items-center'} ${spacingClass}`}
        style={{
          backgroundColor: bg,
          borderRadius: `${radius}`,
          padding: `${padding}`,
        }}
      >
        {box.contents.map((child: any, idx: number) => {
          const childKey = `${key}-${idx}`;
          if (child.type === 'text') return renderText(child, childKey, bg);
          if (child.type === 'box') return renderBox(child, childKey, depth + 1);
          if (child.type === 'separator') {
            return (
              <hr
                key={childKey}
                className={`${child.margin === 'md' ? 'my-3' : child.margin === 'sm' ? 'my-2' : ''} w-full border-0`}
                style={{ height: '1px', backgroundColor: child.color || '#E2E8F0' }}
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  /**
   * Render a single bubble.
   * Wraps the body in a phone-style preview container.
   */
  const renderBubble = (bubble: any, bubbleKey: string): JSX.Element | null => {
    const bodyColor = bubble.body?.backgroundColor || '#FFFFFF';
    const bodyPadding = bubble.body?.paddingAll || '16px';
    if (!Array.isArray(bubble.body?.contents)) return null;

    return (
      <div
        key={bubbleKey}
        className="shrink-0 overflow-hidden"
        style={{
          width: '300px',
          borderRadius: '16px',
          backgroundColor: bodyColor,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            backgroundColor: bodyColor,
            padding: bodyPadding,
            display: 'flex',
            flexDirection: 'column',
            gap: bubble.body.spacing === 'md' ? '12px' : bubble.body.spacing === 'sm' ? '8px' : '12px',
          }}
        >
          {bubble.body.contents.map((item: any, idx: number) => {
            const itemKey = `${bubbleKey}-${idx}`;
            if (item.type === 'box') return renderBox(item, itemKey, 1);
            if (item.type === 'separator') {
              return (
                <hr
                  key={itemKey}
                  className="w-full border-0"
                  style={{ height: '1px', backgroundColor: item.color || '#E2E8F0' }}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  /**
   * Render the entire flexMessage JSON.
   * Handles both single bubble and carousel transparently.
   */
  const renderFlexPreview = (): JSX.Element | null => {
    if (!flexMessage) return null;
    const isCarousel = flexMessage.type === 'carousel' && Array.isArray(flexMessage.contents);
    const isSingleBubble = flexMessage.type === 'bubble';

    if (isSingleBubble) {
      // Single bubble - show directly without horizontal scroll container
      return renderBubble(flexMessage, 'bubble-0');
    }

    if (isCarousel) {
      return (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {flexMessage.contents.map((bubble: any, i: number) => renderBubble(bubble, `bubble-${i}`))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 max-h-[85vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-w-2xl md:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-800">ตัวอย่าง Flex Message</h3>
            <p className="text-xs text-slate-500">สำหรับ {recipient.displayName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Flex Message Preview */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : flexMessage ? (
            renderFlexPreview()
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              ไม่สามารถโหลดตัวอย่าง Flex Message ได้
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="touch-button w-full rounded-2xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-emerald-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
          checked ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function Checkbox({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        console.log('[CHECKBOX CLICK]', {
          current: checked,
          next: !checked,
          disabled
        });

        onCheckedChange(!checked);
      }}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors disabled:opacity-50 ${
        checked
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-slate-300 bg-white'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3}>
          <polyline points="3 8 7 12 13 4" />
        </svg>
      )}
    </button>
  );
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
