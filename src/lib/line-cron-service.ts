/**
 * Shared LINE Cron Service
 * 
 * This module contains the core business logic for LINE cron notifications.
 * It is used by:
 * - /api/line-notify/cron (HTTP endpoint)
 * - Dedicated Cron Worker (scheduled() handler)
 * 
 * This avoids code duplication between HTTP and scheduled handlers.
 */

import { and, eq, isNull, sql, gte, lt, or } from 'drizzle-orm';
import { accounts, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/client';

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
}

export interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
}

export interface LineRecipient {
  lineUserId: string;
  settings: DailySummarySettings;
}

export interface SendResult {
  success: boolean;
  lineUserId: string;
  error?: string;
}

export interface CronResult {
  success: boolean;
  timestamp: string;
  sentAt: string;
  metrics: LineNotificationMetrics;
  recipients: { lineUserId: string; sent: boolean; error?: string }[];
  summary: {
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
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
 * 2. Get dashboard metrics
 * 3. Get enabled recipients
 * 4. Filter by Thai time
 * 5. Send LINE notifications
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

  // 2. Get Dashboard Metrics
  console.log('[LINE Cron] Fetching dashboard metrics...');
  const metrics = await getLineNotificationMetrics(db);
  console.log(`[LINE Cron] Metrics: balance=${metrics.totalBalance.toLocaleString()}`);

  // 3. Get Enabled Recipients
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
      summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
      skipped: { reason: 'No enabled LINE recipients' },
    };
  }

  console.log(`[LINE Cron] Found ${recipients.length} enabled recipients`);

  // 4. Filter recipients by Thai time
  const currentThaiTime = getCurrentBangkokTimeString();
  console.log(`[LINE Cron] Current Thai Time (ICT): ${currentThaiTime}`);

  const recipientsToSend = recipients.filter((r) => {
    const configuredTime = r.settings?.sendTime;
    if (!configuredTime) {
      console.log(`[LINE Cron] Recipient ${r.lineUserId} has no sendTime`);
      return false;
    }
    const match = shouldSendNow(configuredTime);
    console.log(`[LINE Cron] ${r.lineUserId}: configured=${configuredTime} → ${match ? '✅ SEND' : '⏭️ skip'}`);
    return match;
  });

  if (recipientsToSend.length === 0) {
    console.log(`[LINE Cron] No recipients match Thai time ${currentThaiTime}`);
    return {
      success: true,
      timestamp,
      sentAt: getBangkokDateString(),
      metrics,
      recipients: [],
      summary: { totalRecipients: recipients.length, totalSent: 0, totalFailed: 0 },
      skipped: { reason: `No recipients for Thai time ${currentThaiTime}` },
    };
  }

  console.log(`[LINE Cron] 🎯 ${recipientsToSend.length}/${recipients.length} recipients match`);

  // 5. Send LINE notifications
  console.log(`[LINE Cron] Sending daily summary to ${recipientsToSend.length} recipients...`);
  const dateString = getBangkokDateString();

  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const recipient of recipientsToSend) {
    const message = formatDailySummaryMessage(metrics, recipient.settings, dateString);
    const result = await sendLineMessage(recipient.lineUserId, message, LINE_ACCESS_TOKEN);
    results.push(result);

    if (result.success) {
      totalSent++;
    } else {
      totalFailed++;
    }
  }

  console.log(`[LINE Cron] Send complete: ${totalSent} sent, ${totalFailed} failed`);

  // Return Result
  return {
    success: totalFailed === 0,
    timestamp,
    sentAt: dateString,
    metrics,
    recipients: results.map(r => ({ lineUserId: r.lineUserId, sent: r.success, error: r.error })),
    summary: { totalRecipients: recipients.length, totalSent, totalFailed },
    skipped: null,
  };
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
 * Get metrics specifically for LINE notification
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
  // deadline = date + 1 day at 18:00 Bangkok time
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

  return {
    totalBalance: Number(balanceResult?.total_balance) || 0,
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    pendingCount: Number(pendingResult?.cnt) || 0,
    pendingTotal: Number(pendingResult?.total) || 0,
    overdueCount: Number(overdueResult?.cnt) || 0,
    overdueTotal: Number(overdueResult?.total) || 0,
  };
}

/**
 * Get all enabled LINE recipients with their per-user settings
 * 
 * BUGFIX: ดึง row settings ของแต่ละ user_id แยกกัน (LEFT JOIN)
 * เพราะการ query แบบ LIMIT 1 + map ทุก recipient ใช้ settings เดียวกันหมด
 * ทำให้ sendTime ของ user หนึ่งถูกเอาไปใช้กับอีก user หนึ่ง
 */
export async function getEnabledRecipients(db: D1Database): Promise<LineRecipient[]> {
  const defaultSettingsJson = JSON.stringify({
    sendTime: '08:00',
    showBalance: true,
    showIncome: true,
    showExpense: true,
    showPending: true,
    showOverdue: true,
  });

  // LEFT JOIN เพื่อให้ LINE accounts ที่ยังไม่ตั้ง settings ก็ยังได้ default
  // JOIN ตาม user_id ของแต่ละ LINE account (แก้ bug LIMIT 1)
  const result = await db
    .prepare(`
      SELECT
        la.line_user_id,
        COALESCE(ns.settings, ?) as settings
      FROM line_accounts la
      LEFT JOIN notification_settings ns
        ON ns.user_id = la.user_id
        AND ns.notification_type = 'daily_summary'
        AND ns.enabled = 1
      WHERE la.notify_enabled = 1 AND la.deleted_at IS NULL
    `)
    .bind(defaultSettingsJson)
    .all<{ line_user_id: string; settings: string }>();

  return result.results.map(row => ({
    lineUserId: row.line_user_id,
    settings: JSON.parse(row.settings),
  }));
}

// ============================================================
// LINE API FUNCTIONS
// ============================================================

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/**
 * Send LINE message to a user
 */
export async function sendLineMessage(
  lineUserId: string,
  message: string,
  accessToken: string
): Promise<SendResult> {
  try {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LINE Cron] LINE API error for ${lineUserId}: ${response.status} ${errorBody}`);
      return { success: false, lineUserId, error: `LINE API error: ${response.status}` };
    }

    console.log(`[LINE Cron] ✅ Message sent to ${lineUserId}`);
    return { success: true, lineUserId };
  } catch (error) {
    console.error(`[LINE Cron] Failed to send to ${lineUserId}:`, error);
    return { success: false, lineUserId, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================
// MESSAGE FORMATTING
// ============================================================

/**
 * Format daily summary message for LINE
 * Uses emojis and clear formatting for easy reading
 */
export function formatDailySummaryMessage(
  metrics: LineNotificationMetrics,
  settings: DailySummarySettings,
  dateString: string
): string {
  const lines: string[] = [];
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  // Header
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('📊 Smart Family Finance');
  lines.push('🗓️ วันที่ ' + dateString);
  lines.push('━━━━━━━━━━━━━━━');

  // Balance
  if (settings.showBalance) {
    lines.push('');
    lines.push('💰 คงเหลือรวม');
    lines.push('   ' + fmt(metrics.totalBalance) + ' บาท');
  }

  // Income & Expense
  if (settings.showIncome || settings.showExpense) {
    lines.push('');
    lines.push('📈 รายรับเดือนนี้');
    lines.push('   ' + fmt(metrics.monthlyIncome) + ' บาท');
    lines.push('');
    lines.push('📉 รายจ่ายเดือนนี้');
    lines.push('   ' + fmt(metrics.monthlyExpense) + ' บาท');
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━');
    
    const netEmoji = metrics.monthlyNet >= 0 ? '✅' : '❌';
    const netColor = metrics.monthlyNet >= 0 ? '+' : '';
    lines.push(netEmoji + ' สุทธิเดือนนี้');
    lines.push('   ' + netColor + fmt(metrics.monthlyNet) + ' บาท');
  }

  // Pending & Overdue
  if (settings.showPending || settings.showOverdue) {
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━');

    if (settings.showPending) {
      if (metrics.pendingCount > 0) {
        lines.push('⚠️ รอชำระ');
        lines.push('   ' + metrics.pendingCount + ' รายการ');
        lines.push('   ' + fmt(metrics.pendingTotal) + ' บาท');
      } else {
        lines.push('✅ รอชำระ');
        lines.push('   ไม่มีรายการ');
      }
    }

    if (settings.showOverdue) {
      if (metrics.overdueCount > 0) {
        lines.push('');
        lines.push('🚨 เกินกำหนด');
        lines.push('   ' + metrics.overdueCount + ' รายการ');
        lines.push('   ' + fmt(metrics.overdueTotal) + ' บาท');
      } else {
        lines.push('');
        lines.push('✅ ไม่มีรายการเกินกำหนด');
      }
    }
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('📱 ส่งอัตโนมัติโดย Smart Family Finance');

  return lines.join('\n');
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
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
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
  const day = parts.find(p => p.type === 'day')?.value || '00';
  const month = parts.find(p => p.type === 'month')?.value || '00';
  const yearCE = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
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
    },
    recipients: [],
    summary: { totalRecipients: 0, totalSent: 0, totalFailed: 0 },
    skipped: { reason },
  };
}
