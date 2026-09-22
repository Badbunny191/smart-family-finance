'use client';

/**
 * LINE Notification Settings Page
 *
 * Configure:
 * - Enable/disable daily summary
 * - Send time (HH:mm)
 * - Which sections to include in LINE message
 * - Manage recipients (toggle per-line_account)
 * - Test send now
 * - Display bot status
 */

import { ArrowLeft, Bell, CheckCircle2, Clock, Loader2, Send, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { MobileNav } from '@/components/mobile-nav';
import { useToast } from '@/components/ui/toast';

interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
}

interface Recipient {
  id: string;
  userId: string;
  lineUserId: string;
  displayName: string;
  notifyEnabled: boolean;
}

interface LineSettingsResponse {
  success: boolean;
  settings: DailySummarySettings;
  enabled: boolean;
  lastTestAt: string | null;
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

const DEFAULT_SETTINGS: DailySummarySettings = {
  sendTime: '08:00',
  showBalance: true,
  showIncome: true,
  showExpense: true,
  showPending: true,
  showOverdue: true,
};

const TIME_PRESETS = ['07:00', '08:00', '12:00', '17:00', '17:30', '18:00', '20:00', '21:00', '21:59'];

export default function LineSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [togglingRecipientId, setTogglingRecipientId] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<DailySummarySettings>(DEFAULT_SETTINGS);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientSummary, setRecipientSummary] = useState({ total: 0, enabled: 0 });
  const [bot, setBot] = useState<{
    connected: boolean;
    hasAccessToken: boolean;
    tokenVerified: boolean;
    botBasicId: string | null;
    botName: string | null;
    botDisplayName: string | null;
    botPictureUrl: string | null;
    verifyError: string | null;
  }>({
    connected: false,
    hasAccessToken: false,
    tokenVerified: false,
    botBasicId: null,
    botName: null,
    botDisplayName: null,
    botPictureUrl: null,
    verifyError: null,
  });
  const [lastTestAt, setLastTestAt] = useState<string | null>(null);

  // Auto-save debounce ref
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Load on mount -----
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/line');
      const json = (await res.json()) as LineSettingsResponse;
      if (json.success) {
        setSettings(json.settings ?? DEFAULT_SETTINGS);
        setEnabled(json.enabled);
        setRecipients(json.recipients ?? []);
        setRecipientSummary(json.recipientSummary ?? { total: 0, enabled: 0 });
        setBot(json.bot);
        setLastTestAt(json.lastTestAt);
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

  // ----- Save settings -----
  const save = useCallback(
    async (overrides?: { enabled?: boolean; settings?: Partial<DailySummarySettings> }) => {
      try {
        setSaving(true);
        const body: { enabled?: boolean; settings?: DailySummarySettings } = {};

        if (overrides?.enabled !== undefined) {
          body.enabled = overrides.enabled;
        }
        if (overrides?.settings) {
          body.settings = { ...settings, ...overrides.settings };
        } else if (!overrides?.enabled) {
          body.settings = settings;
        }

        const res = await fetch('/api/settings/line', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
          showToast(`บันทึกไม่สำเร็จ: ${json.error ?? ''}`, 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('บันทึกไม่สำเร็จ', 'error');
      } finally {
        setSaving(false);
      }
    },
    [settings, showToast]
  );

  // Debounced save when settings change
  const scheduleSave = useCallback(
    (next: DailySummarySettings) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        save({ settings: next });
      }, 600);
    },
    [save]
  );

  const updateSetting = <K extends keyof DailySummarySettings>(
    key: K,
    value: DailySummarySettings[K]
  ) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    scheduleSave(next);
  };

  // Toggle enabled
  const toggleEnabled = (next: boolean) => {
    setEnabled(next);
    save({ enabled: next });
  };

  // Toggle recipient
  const toggleRecipient = async (recipient: Recipient) => {
    const next = !recipient.notifyEnabled;
    setTogglingRecipientId(recipient.id);

    // Optimistic update
    setRecipients((prev) =>
      prev.map((r) =>
        r.id === recipient.id ? { ...r, notifyEnabled: next } : r
      )
    );
    setRecipientSummary((prev) => ({
      total: prev.total,
      enabled: prev.enabled + (next ? 1 : -1),
    }));

    try {
      const res = await fetch('/api/settings/line/recipients', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lineAccountId: recipient.id,
          notifyEnabled: next,
        }),
      });
      const json = (await res.json()) as { success: boolean };
      if (!json.success) {
        // Revert
        setRecipients((prev) =>
          prev.map((r) =>
            r.id === recipient.id ? { ...r, notifyEnabled: recipient.notifyEnabled } : r
          )
        );
        showToast('อัปเดตผู้รับไม่สำเร็จ', 'error');
      }
    } catch (err) {
      console.error(err);
      // Revert
      setRecipients((prev) =>
        prev.map((r) =>
          r.id === recipient.id ? { ...r, notifyEnabled: recipient.notifyEnabled } : r
        )
      );
      showToast('อัปเดตผู้รับไม่สำเร็จ', 'error');
    } finally {
      setTogglingRecipientId(null);
    }
  };

  // Test send
  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await fetch('/api/settings/line/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        summary?: { totalSent: number; totalFailed: number };
      };
      const now = new Date().toISOString();
      setLastTestAt(now);

      if (json.success) {
        showToast(
          `ส่งสำเร็จ ${json.summary?.totalSent ?? 0} คน ล้มเหลว ${json.summary?.totalFailed ?? 0}`,
          'success'
        );
      } else {
        showToast(`ส่งไม่สำเร็จ: ${json.error ?? 'กรุณาลองใหม่อีกครั้ง'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('ส่ง LINE ทดสอบไม่สำเร็จ', 'error');
    } finally {
      setTesting(false);
    }
  };

  // ----- Render sections -----
  const renderSection = (icon: React.ElementType, title: string, content: React.ReactNode) => (
    <section className="border-t border-slate-100 px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          {icon && (() => {
            const Icon = icon;
            return <Icon size={16} />;
          })()}
        </span>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {saving && <Loader2 className="ml-auto animate-spin text-slate-400" size={14} />}
      </div>
      <div>{content}</div>
    </section>
  );

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
          ตั้งค่าการแจ้งเตือนรายวันผ่าน LINE
        </p>
      </header>

      {/* Single Card with Sections */}
      <section className="px-5 py-5">
        <div className="surface-card overflow-hidden">

          {/* Section 1: Enable / Disable */}
          {renderSection(Bell, 'เปิดใช้งาน', (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="font-medium text-slate-800">
                เปิดใช้งาน LINE Daily Summary
              </span>
              <Switch checked={enabled} onCheckedChange={toggleEnabled} />
            </label>
          ))}

          {/* Section 2: Send time */}
          {renderSection(Clock, 'เวลาแจ้งเตือน', (
            <div className="space-y-3">
              <input
                type="time"
                value={settings.sendTime}
                onChange={(e) => updateSetting('sendTime', e.target.value)}
                disabled={!enabled}
                className="form-input font-mono text-base disabled:opacity-50"
              />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  ตัวอย่างเวลา
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIME_PRESETS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!enabled}
                      onClick={() => updateSetting('sendTime', t)}
                      className={`rounded-full border px-3 py-1 font-mono text-xs disabled:opacity-40 ${
                        settings.sendTime === t
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Section 3: Sections to show */}
          {renderSection(CheckCircle2, 'เลือกข้อมูลที่จะแสดงใน LINE', (
            <div className="space-y-2">
              {[
                { key: 'showBalance' as const, label: 'ยอดคงเหลือรวม' },
                { key: 'showIncome' as const, label: 'รายรับเดือนนี้' },
                { key: 'showExpense' as const, label: 'รายจ่ายเดือนนี้' },
                { key: 'showPending' as const, label: 'รายการรอชำระ' },
                { key: 'showOverdue' as const, label: 'รายการเกินกำหนด' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-800">{label}</span>
                  <Checkbox
                    checked={settings[key]}
                    disabled={!enabled}
                    onCheckedChange={(v) => updateSetting(key, !!v)}
                  />
                </label>
              ))}
              <p className="pt-1 text-xs text-slate-400">
                * ยอดสุทธิจะแสดงอัตโนมัติเมื่อเปิดทั้งรายรับและรายจ่าย
              </p>
            </div>
          ))}

          {/* Section 4: Recipients */}
          {renderSection(Users, 'ผู้รับ', (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                เปิด/ปิด การส่ง LINE ให้ผู้รับแต่ละคน
              </p>
              {recipients.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  ยังไม่มีผู้รับ — ต้องเพิ่ม LINE User ID ก่อน
                </div>
              ) : (
                <div className="space-y-2">
                  {recipients.map((r) => (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 hover:border-slate-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {r.displayName}
                        </p>
                        <p className="font-mono text-xs text-slate-400">
                          {r.lineUserId.slice(0, 12)}…
                        </p>
                      </div>
                      <Switch
                        checked={r.notifyEnabled}
                        disabled={togglingRecipientId === r.id}
                        onCheckedChange={() => toggleRecipient(r)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Section 5: Test send */}
          {renderSection(Send, 'ทดสอบ', (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || recipientSummary.enabled === 0}
              className="touch-button flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(22,134,107,0.25)] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {testing ? 'กำลังส่ง...' : 'ทดสอบส่ง LINE ตอนนี้'}
            </button>
          ))}

          {/* Section 6: Status */}
          {renderSection(CheckCircle2, 'สถานะ', (
            <div className="space-y-3 text-sm">
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
                    <span className="text-rose-700">Not configured — ตั้ง LINE_CHANNEL_ACCESS_TOKEN</span>
                  )
                }
              />
              {bot.botName && (
                <StatusRow label="Bot ID" value={<span className="font-mono">{bot.botName}</span>} />
              )}
              {bot.botDisplayName && (
                <StatusRow label="Bot Name" value={bot.botDisplayName} />
              )}
              <StatusRow
                label="ผู้รับ"
                value={
                  <span className="text-slate-700">
                    {recipientSummary.enabled} คน
                    <span className="text-slate-400"> (จากทั้งหมด {recipientSummary.total})</span>
                  </span>
                }
              />
              <StatusRow
                label="ทดสอบล่าสุด"
                value={
                  lastTestAt ? (
                    <span className="text-slate-700">
                      {new Date(lastTestAt).toLocaleString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  ) : (
                    <span className="text-slate-400">ยังไม่เคยทดสอบ</span>
                  )
                }
              />
            </div>
          ))}
        </div>
      </section>

      <MobileNav />
    </main>
  );
}

// ============================================================
// Sub-components (inline to keep file count low)
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
      onClick={() => onCheckedChange(!checked)}
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
      <span className="font-medium">{value}</span>
    </div>
  );
}
