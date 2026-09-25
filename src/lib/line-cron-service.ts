/**
 * Shared LINE Cron Service
 *
 * This module contains the core business logic for LINE cron notifications.
 * It is used by:
 * - /api/line-notify/cron (HTTP endpoint)
 * - Dedicated Cron Worker (scheduled() handler)
 *
 * This avoids code duplication between HTTP and scheduled handlers.
 *
 * CHANGES (v2 — Time Picker + Flex Message + Daily Deduplication):
 * - Uses Asia/Bangkok timezone for both time and date comparisons.
 * - Reads sendTime from notification_settings per user.
 * - Sends FLEX MESSAGE (not text) — same builder as Test Send.
 * - DEDUP: skips recipients whose last_sent_at falls on the same Bangkok date.
 * - Updates last_sent_at only on successful send.
 */

import { and, eq, isNull, sql, gte, lt, or } from 'drizzle-orm';
import { accounts, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/client';
import { sendDailySummaryFlexToUser, type LineNotificationMetrics as FlexMetrics } from './line-flex-sender';

// ============================================================
// TYPES
// ============================================================

export interface LineNotificationMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  pendingItems?: Array<{ title: string; amount: number }>;
  overdueItems?: Array<{ title: string; amount: number }>;
}

export interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails?: boolean;
  showOverdueDetails?: boolean;
}

export interface LineRecipient {
  lineUserId: string;
  userId?: string;
  settings: DailySummarySettings;
  lastSentAt?: number | null;  // unix seconds (Asia/Bangkok date used for dedup)
}

export interface SendResult {
  success: boolean;
  lineUserId: string;
  error?: string;
  skipped?: string;
}

export interface CronResult {
  success: boolean;
  timestamp: string;
  sentAt: string;
  metrics: LineNotificationMetrics;
  recipients: { lineUserId: string; sent: boolean; error?: string; skipped?: string }[];
  summary: {
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
  };
  skipped: { reason: string } | null;
}

export interface Env {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

// ============================================================
// PUBLIC API: Run LINE Cron
// ============================================================

/**
 * Run LINE Cron Job
 *
 * This is the main entry point that handles the entire cron workflow:
 * 1. Validate environment
 * 2. Get dashboard metrics (with items for Flex Message)
 * 3. Get enabled recipients (with last_sent_at for dedup)
 * 4. Filter by Thai time AND dedup (skip if sent today)
 * 5. Send LINE Flex Messages
 * 6. Update last_sent_at on success
 *
 * @param db - D1 Database instance
 * @param LINE_ACCESS_TOKEN - LINE Channel Access Token
 * @returns CronResult with execution details
 */
export async function runLineCron(
  db: D1Database,
  LINE_ACCESS_TOKEN: string
): Promise<CronResult> {
  const timestamp = new Date().toISOString();

  // 1. Validate Environment
  if (!LINE_ACCESS_TOKEN) {
    console.error('[LINE Cron] LINE_CHANNEL_ACCESS_TOKEN not configured');
    return createErrorResult(timestamp, 'LINE_CHANNEL_ACCESS_TOKEN not configured');
  }

  // 2. Get Dashboard Metrics (with items for Flex Message)
  console.log('[LINE Cron] Fetching dashboard metrics...');
  const metrics = await getLineNotificationMetrics(db);
  console.log(`[LINE Cron] Metrics: balance=${metrics.totalBalance.toLocaleString()}`);

  // 3. Get Enabled Recipients (with last_sent_at for dedup)
  console.log('[LINE Cron] Fetching enabled recipients...');
  const recipients = await getEnabledRecipients(db);

  if (recipients.length === 0) {
    console.log('[LINE Cron] No enabled recipients');
    return {
      success: true,
      timestamp,
      sentAt: getBangkokDateString(),
      metrics,
      recipients: [],
      summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0, totalSkipped: 0 },
      skipped: { reason: 'No enabled LINE recipients' },
    };
  }

  console.log(`[LINE Cron] Found ${recipients.length} enabled recipients`);

  // 4. Filter recipients by Thai time AND dedup
  const currentThaiTime = getCurrentBangkokTimeString();
  const currentBangkokDate = getBangkokDateString();
  console.log(`[LINE Cron] Current Thai Date (ICT): ${currentBangkokDate}`);
  console.log(`[LINE Cron] Current Thai Time (ICT): ${currentThaiTime}`);

  const matchResult = filterRecipientsByTimeAndDedup(
    recipients,
    currentThaiTime,
    currentBangkokDate
  );

  console.log(
    `[LINE Cron] 🎯 ${matchResult.toSend.length} to send, ${matchResult.skippedByDedup.length} already sent today`
  );

  if (matchResult.toSend.length === 0) {
    return {
      success: true,
      timestamp,
      sentAt: currentBangkokDate,
      metrics,
      recipients: matchResult.skippedByDedup.map((r) => ({
        lineUserId: r.lineUserId,
        sent: false,
        skipped: 'already sent today',
      })),
      summary: {
        totalRecipients: recipients.length,
        totalSent: 0,
        totalFailed: 0,
        totalSkipped: matchResult.skippedByDedup.length,
      },
      skipped: { reason: `No recipients match Thai time ${currentThaiTime} (or already sent today)` },
    };
  }

  // 5. Send LINE FLEX notifications
  console.log(`[LINE Cron] Sending Flex Messages to ${matchResult.toSend.length} recipients...`);

  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const recipient of matchResult.toSend) {
    const result = await sendDailySummaryFlexToUser(
      recipient.lineUserId,
      // Convert to the flex-sender expected shape
      {
        totalBalance: metrics.totalBalance,
        monthlyIncome: metrics.monthlyIncome,
        monthlyExpense: metrics.monthlyExpense,
        monthlyNet: metrics.monthlyNet,
        pendingCount: metrics.pendingCount,
        pendingTotal: metrics.pendingTotal,
        overdueCount: metrics.overdueCount,
        overdueTotal: metrics.overdueTotal,
        pendingItems: metrics.pendingItems ?? [],
        overdueItems: metrics.overdueItems ?? [],
      } as FlexMetrics,
      {
        sendTime: recipient.settings.sendTime,
        showBalance: recipient.settings.showBalance,
        showIncome: recipient.settings.showIncome,
        showExpense: recipient.settings.showExpense,
        showPending: recipient.settings.showPending,
        showOverdue: recipient.settings.showOverdue,
        showPendingDetails: recipient.settings.showPendingDetails ?? true,
        showOverdueDetails: recipient.settings.showOverdueDetails ?? true,
      },
      LINE_ACCESS_TOKEN
    );
    results.push(result);

    if (result.success) {
      totalSent++;
      // Update last_sent_at only after successful send
      if (recipient.userId) {
        try {
          await updateLastSentAt(db, recipient.userId, currentBangkokDate);
        } catch (e) {
          console.warn(`[LINE Cron] Failed to update last_sent_at for ${recipient.userId}:`, e);
        }
      }
    } else {
      totalFailed++;
    }
  }

  console.log(`[LINE Cron] Send complete: ${totalSent} sent, ${totalFailed} failed`);

  return {
    success: totalFailed === 0,
    timestamp,
    sentAt: currentBangkokDate,
    metrics,
    recipients: [
      ...results.map((r) => ({
        lineUserId: r.lineUserId,
        sent: r.success,
        error: r.error,
      })),
      ...matchResult.skippedByDedup.map((r) => ({
        lineUserId: r.lineUserId,
        sent: false,
        skipped: 'already sent today',
      })),
    ],
    summary: {
      totalRecipients: recipients.length,
      totalSent,
      totalFailed,
      totalSkipped: matchResult.skippedByDedup.length,
    },
    skipped: null,
  };
}

// ============================================================
// DEDUP + TIME FILTER
// ============================================================

/**
 * Filter recipients by Thai time AND dedup (skip if already sent today).
 *
 * - Time match: configured sendTime (HH:mm) === current Bangkok time HH:mm
 * - Dedup: lastSentAt's Bangkok date !== current Bangkok date
 */
function filterRecipientsByTimeAndDedup(
  recipients: LineRecipient[],
  currentThaiTime: string,
  currentBangkokDate: string
): { toSend: LineRecipient[]; skippedByDedup: LineRecipient[] } {
  const [curHour, curMin] = currentThaiTime.split(':').map(Number);

  const toSend: LineRecipient[] = [];
  const skippedByDedup: LineRecipient[] = [];

  for (const r of recipients) {
    const configuredTime = r.settings?.sendTime;
    if (!configuredTime) {
      console.log(`[LINE Cron] Recipient ${r.lineUserId} has no sendTime — skipping`);
      continue;
    }
    const [sendHour, sendMinute] = configuredTime.split(':').map(Number);
    const timeMatch = curHour === sendHour && curMin === sendMinute;
    if (!timeMatch) continue;

    // Dedup check: was this recipient already notified today (Bangkok)?
    if (r.lastSentAt) {
      const lastSentBangkokDate = bangkokDateFromUnixSeconds(r.lastSentAt);
      if (lastSentBangkokDate === currentBangkokDate) {
        console.log(
          `[LINE Cron] ${r.lineUserId}: already sent on ${lastSentBangkokDate} — skipping`
        );
        skippedByDedup.push(r);
        continue;
      }
    }
    toSend.push(r);
  }

  return { toSend, skippedByDedup };
}

/**
 * Convert unix seconds → Bangkok date string "DD/MM/YYYY+543"
 */
function bangkokDateFromUnixSeconds(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value || '00';
  const month = parts.find((p) => p.type === 'month')?.value || '00';
  const yearCE = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
  const yearBE = yearCE + 543;
  return `${day}/${month}/${yearBE}`;
}

/**
 * Update last_sent_at for a user (used after successful Flex Message send).
 * Uses the start of the current Bangkok day as the stored value so the dedup
 * comparison stays on date boundaries regardless of the actual send second.
 */
async function updateLastSentAt(
  db: D1Database,
  userId: string,
  bangkokDateString: string
): Promise<void> {
  // Store the current unix timestamp (seconds) — sufficient for date-based dedup.
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE notification_settings
       SET last_sent_at = ?, updated_at = ?
       WHERE user_id = ? AND notification_type = 'daily_summary'`
    )
    .bind(nowSec, nowSec, userId)
    .run();
  console.log(`[LINE Cron] ✅ Updated last_sent_at for user ${userId} (date=${bangkokDateString})`);
}

// ============================================================
// DATABASE QUERIES
// ============================================================

/**
 * Get current month range in UTC
 */
function getCurrentMonthRange(): { monthStart: string; nextMonthStart: string } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    monthStart: monthStart.toISOString(),
    nextMonthStart: nextMonthStart.toISOString(),
  };
}

/**
 * Get metrics for LINE notification (with items for Flex Message).
 */
export async function getLineNotificationMetrics(db: D1Database): Promise<LineNotificationMetrics> {
  const { monthStart, nextMonthStart } = getCurrentMonthRange();

  // Query 1: Total Balance
  const balanceResult = await db
    .prepare(`
      SELECT COALESCE(SUM(current_balance), 0) as total_balance
      FROM accounts
      WHERE account_type IN ('cash', 'bank') AND deleted_at IS NULL
    `)
    .first<{ total_balance: number }>();

  // Query 2: Monthly Income/Expense
  const incomeExpenseResult = await db
    .prepare(`
      SELECT type, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE status = 'completed'
        AND date >= ?
        AND date < ?
        AND type IN ('income', 'expense')
        AND deleted_at IS NULL
        GROUP BY type
    `)
    .bind(monthStart, nextMonthStart)
    .all<{ type: string; total: number }>();

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const row of incomeExpenseResult.results) {
    if (row.type === 'income') monthlyIncome = Number(row.total);
    else if (row.type === 'expense') monthlyExpense = Number(row.total);
  }

  // Query 3: Pending (not yet overdue)
  const pendingResult = await db
    .prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income'
        AND business_status = 'pending'
        AND deleted_at IS NULL
        AND datetime(datetime(date, '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')
    `)
    .first<{ cnt: number; total: number }>();

  // Query 4: Overdue
  const overdueResult = await db
    .prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income'
        AND business_status = 'pending'
        AND deleted_at IS NULL
        AND datetime(datetime(date, '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')
    `)
    .first<{ cnt: number; total: number }>();

  // Query 5: Pending items (top 5 ordered by oldest)
  const pendingItemsResult = await db
    .prepare(`
      SELECT title, amount
      FROM transactions
      WHERE type = 'income'
        AND business_status = 'pending'
        AND deleted_at IS NULL
        AND datetime(datetime(date, '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')
      ORDER BY date ASC
      LIMIT 5
    `)
    .all<{ title: string; amount: number }>();

  // Query 6: Overdue items (top 5 oldest)
  const overdueItemsResult = await db
    .prepare(`
      SELECT title, amount
      FROM transactions
      WHERE type = 'income'
        AND business_status = 'pending'
        AND deleted_at IS NULL
        AND datetime(datetime(date, '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')
      ORDER BY date ASC
      LIMIT 5
    `)
    .all<{ title: string; amount: number }>();

  return {
    totalBalance: Number(balanceResult?.total_balance) || 0,
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    pendingCount: Number(pendingResult?.cnt) || 0,
    pendingTotal: Number(pendingResult?.total) || 0,
    overdueCount: Number(overdueResult?.cnt) || 0,
    overdueTotal: Number(overdueResult?.total) || 0,
    pendingItems: pendingItemsResult.results.map((r) => ({
      title: r.title,
      amount: Number(r.amount) || 0,
    })),
    overdueItems: overdueItemsResult.results.map((r) => ({
      title: r.title,
      amount: Number(r.amount) || 0,
    })),
  };
}

/**
 * Get all enabled LINE recipients with their per-user settings.
 * Also reads last_sent_at for daily dedup.
 */
export async function getEnabledRecipients(db: D1Database): Promise<LineRecipient[]> {
  const defaultSettingsJson = JSON.stringify({
    sendTime: '08:00',
    showBalance: true,
    showIncome: true,
    showExpense: true,
    showPending: true,
    showOverdue: true,
    showPendingDetails: true,
    showOverdueDetails: true,
  });

  const result = await db
    .prepare(`
      SELECT
        la.line_user_id,
        la.user_id,
        COALESCE(ns.settings, ?) as settings,
        ns.last_sent_at as last_sent_at
      FROM line_accounts la
      LEFT JOIN notification_settings ns
        ON ns.user_id = la.user_id
        AND ns.notification_type = 'daily_summary'
        AND ns.enabled = 1
      WHERE la.notify_enabled = 1 AND la.deleted_at IS NULL
    `)
    .bind(defaultSettingsJson)
    .all<{
      line_user_id: string;
      user_id: string | number | null;
      settings: string;
      last_sent_at: number | null;
    }>();

  return result.results.map((row) => ({
    lineUserId: row.line_user_id,
    userId: row.user_id != null ? String(row.user_id) : undefined,
    settings: JSON.parse(row.settings),
    lastSentAt: row.last_sent_at ?? null,
  }));
}

// ============================================================
// TIME HELPERS (Asia/Bangkok)
// ============================================================

function getBangkokTime(): { hour: number; minute: number; timeString: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const normalizedHour = hour === 24 ? 0 : hour;

  return {
    hour: normalizedHour,
    minute,
    timeString: `${normalizedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
  };
}

export function shouldSendNow(sendTime: string): boolean {
  const bangkok = getBangkokTime();
  const [sendHour, sendMinute] = sendTime.split(':').map(Number);
  return bangkok.hour === sendHour && bangkok.minute === sendMinute;
}

export function getCurrentBangkokTimeString(): string {
  return getBangkokTime().timeString;
}

export function getBangkokDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(new Date());
  const day = parts.find((p) => p.type === 'day')?.value || '00';
  const month = parts.find((p) => p.type === 'month')?.value || '00';
  const yearCE = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
  const yearBE = yearCE + 543;

  return `${day}/${month}/${yearBE}`;
}

// ============================================================
// HELPERS
// ============================================================

function createErrorResult(timestamp: string, reason: string): CronResult {
  return {
    success: false,
    timestamp,
    sentAt: getBangkokDateString(),
    metrics: {
      totalBalance: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyNet: 0,
      pendingCount: 0,
      pendingTotal: 0,
      overdueCount: 0,
      overdueTotal: 0,
      pendingItems: [],
      overdueItems: [],
    },
    recipients: [],
    summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0, totalSkipped: 0 },
    skipped: { reason },
  };
}
