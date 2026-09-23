/**
 * LINE Cron Worker - Dedicated Worker for Scheduled LINE Notifications
 * 
 * ES Module format required for D1 binding.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │   Cloudflare Cron Trigger (every minute)                   │
 * │   → scheduled() handler                                    │
 * └─────────────────────────────────────────────────────────────┘
 *                        │
 *                        ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │   LINE Cron Worker (ES Module)                            │
 * │   - Has scheduled() export (required by Cloudflare)        │
 * │   - Has fetch() for health check                           │
 * │   - Uses D1 database with Drizzle ORM                      │
 * │   - SAME business logic as Dashboard/Test Send             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte, lt, isNull, inArray, sql, or } from 'drizzle-orm';
import * as schema from '../../db/schema';

// ============================================================
// TYPES
// ============================================================

export interface Env {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

export interface CronEvent {
  scheduledTime: number;
  cron: string;
}

interface LineNotificationMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
}

interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
}

interface RecipientWithSettings {
  lineUserId: string;
  userId: number;
  settings: DailySummarySettings;
}

interface SendResult {
  success: boolean;
  lineUserId: string;
  error?: string;
}

interface CronResult {
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

const WORKER_NAME = 'smart-family-finance-line-cron';

// ============================================================
// CLOUDFLARE WORKER EXPORTS
// ============================================================

export default {
  async scheduled(
    event: { scheduledTime: number; cron: string },
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();

    try {
      if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.DB) {
        console.error(`[${WORKER_NAME}] Missing required bindings`);
        throw new Error('Missing required bindings');
      }

      const result = await runLineCron(env.DB, env.LINE_CHANNEL_ACCESS_TOKEN);
      
      const elapsed = Date.now() - startTime;
      
      if (result.skipped) {
        console.log(`[${WORKER_NAME}] Skipped: ${result.skipped.reason} (${elapsed}ms)`);
      } else {
        console.log(`[${WORKER_NAME}] Sent ${result.summary.totalSent}/${result.summary.totalRecipients} messages (${elapsed}ms)`);
      }
      
    } catch (error) {
      console.error(`[${WORKER_NAME}] Error:`, error);
      throw error;
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        worker: WORKER_NAME,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Info endpoint with metrics
    if (url.pathname === '/info') {
      const utcNow = new Date();
      const bangkokTime = getCurrentBangkokTimeString();
      const bangkokDate = getBangkokDateString();
      
      let metrics: LineNotificationMetrics | null = null;
      try {
        metrics = await getLineNotificationMetrics(env.DB);
      } catch (e) {
        console.error('Failed to fetch metrics:', e);
      }
      
      return Response.json({
        workerName: WORKER_NAME,
        currentUTC: utcNow.toISOString(),
        currentBangkokTime: bangkokTime,
        currentBangkokDate: bangkokDate,
        hasAccessToken: !!env.LINE_CHANNEL_ACCESS_TOKEN,
        databaseBinding: !!env.DB,
        metrics,
      });
    }
    
    return Response.json({
      error: 'Not found',
      paths: ['/health', '/info'],
    }, { status: 404 });
  }
};

// ============================================================
// CRON LOGIC
// ============================================================

async function runLineCron(
  db: D1Database,
  LINE_ACCESS_TOKEN: string
): Promise<CronResult> {
  const timestamp = new Date().toISOString();
  
  // 1. Get Dashboard Metrics (SAME as Dashboard/Test Send)
  const metrics = await getLineNotificationMetrics(db);

  // 2. Get recipients with per-user settings
  const recipients = await getEnabledRecipients(db);

  if (recipients.length === 0) {
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

  // 3. Filter by Thai time - per user
  const currentThaiTime = getCurrentBangkokTimeString();
  const currentThaiDate = getBangkokDateString();
  const bangkokTimeParts = getBangkokTime();

  const recipientsToSend: RecipientWithSettings[] = [];

  for (const recipient of recipients) {
    const configuredTime = recipient.settings?.sendTime || '08:00';
    const [configHour, configMinute] = configuredTime.split(':').map(Number);
    
    const match = bangkokTimeParts.hour === configHour && bangkokTimeParts.minute === configMinute;
    
    if (match) {
      recipientsToSend.push(recipient);
    }
  }

  if (recipientsToSend.length === 0) {
    return {
      success: true,
      timestamp,
      sentAt: currentThaiDate,
      metrics,
      recipients: [],
      summary: { totalRecipients: recipients.length, totalSent: 0, totalFailed: 0 },
      skipped: { reason: `No recipients for ${currentThaiTime}` },
    };
  }

  // 4. Send LINE notifications
  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const recipient of recipientsToSend) {
    const message = formatDailySummaryMessage(metrics, recipient.settings, currentThaiDate);
    const result = await sendLineMessage(recipient.lineUserId, message, LINE_ACCESS_TOKEN);
    results.push(result);
    
    if (result.success) {
      totalSent++;
    } else {
      totalFailed++;
      console.error(`[${WORKER_NAME}] Failed to send to user_id=${recipient.userId}: ${result.error}`);
    }
  }

  return {
    success: totalFailed === 0,
    timestamp,
    sentAt: currentThaiDate,
    metrics,
    recipients: results.map(r => ({ lineUserId: r.lineUserId, sent: r.success, error: r.error })),
    summary: { totalRecipients: recipients.length, totalSent, totalFailed },
    skipped: null,
  };
}

// ============================================================
// DATABASE QUERIES - SAME LOGIC AS dashboard-summary.ts
// ============================================================

/**
 * Get current month range in UTC
 * CRITICAL: transactions.date is stored as Unix timestamp (integer, milliseconds)
 * We use Date objects so Drizzle ORM handles conversion correctly
 */
function getCurrentMonthRange(): { monthStart: Date; nextMonthStart: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

/**
 * Get metrics for LINE notification
 * 
 * THIS IS THE EXACT SAME FUNCTION USED BY DASHBOARD AND TEST SEND!
 * Uses Drizzle ORM which correctly handles:
 * - Unix timestamp (integer) storage in transactions.date
 * - Date object comparisons
 */
async function getLineNotificationMetrics(db: D1Database): Promise<LineNotificationMetrics> {
  const { monthStart, nextMonthStart } = getCurrentMonthRange();
  
  // Create Drizzle instance with schema
  const drizzleDb = drizzle(db, { schema });

  // QUERY 1: Total Balance (same as dashboard-summary.ts)
  const balanceResult = await drizzleDb
    .select({
      totalBalance: sql<number>`COALESCE(SUM(${schema.accounts.currentBalance}), 0)`,
    })
    .from(schema.accounts)
    .where(and(
      inArray(schema.accounts.accountType, ['cash', 'bank']),
      isNull(schema.accounts.deletedAt)
    ));

  // QUERY 2: Monthly income/expense (same as dashboard-summary.ts)
  const incomeExpenseResult = await drizzleDb
    .select({
      type: schema.transactions.type,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.status, 'completed'),
      gte(schema.transactions.date, monthStart),
      lt(schema.transactions.date, nextMonthStart),
      or(eq(schema.transactions.type, 'income'), eq(schema.transactions.type, 'expense')),
      isNull(schema.transactions.deletedAt)
    ))
    .groupBy(schema.transactions.type);

  // QUERY 3: Pending (not yet overdue)
  // deadline = date (Bangkok) + 1 day at 18:00
  // Not overdue = now < deadline
  const pendingResult = await drizzleDb
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.type, 'income'),
      eq(schema.transactions.businessStatus, 'pending'),
      isNull(schema.transactions.deletedAt),
      sql`datetime(datetime(${schema.transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
    ));

  // QUERY 4: Overdue
  const overdueResult = await drizzleDb
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.type, 'income'),
      eq(schema.transactions.businessStatus, 'pending'),
      isNull(schema.transactions.deletedAt),
      sql`datetime(datetime(${schema.transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
    ));

  // Process results
  const totalBalance = Number(balanceResult[0]?.totalBalance) || 0;

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const row of incomeExpenseResult) {
    if (row.type === 'income') {
      monthlyIncome = Number(row.total) || 0;
    } else if (row.type === 'expense') {
      monthlyExpense = Number(row.total) || 0;
    }
  }

  const pendingMetrics = pendingResult[0] || { total: 0, count: 0 };
  const overdueMetrics = overdueResult[0] || { total: 0, count: 0 };

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    pendingCount: Number(pendingMetrics.count) || 0,
    pendingTotal: Number(pendingMetrics.total) || 0,
    overdueCount: Number(overdueMetrics.count) || 0,
    overdueTotal: Number(overdueMetrics.total) || 0,
  };
}

/**
 * Get all enabled LINE recipients with their per-user settings
 */
async function getEnabledRecipients(db: D1Database): Promise<RecipientWithSettings[]> {
  // Join line_accounts with notification_settings to get per-user settings
  const query = `
    SELECT 
      la.line_user_id,
      la.user_id,
      COALESCE(ns.settings, '{"sendTime":"08:00","showBalance":true,"showIncome":true,"showExpense":true,"showPending":true,"showOverdue":true}') as settings
    FROM line_accounts la
    LEFT JOIN notification_settings ns 
      ON ns.user_id = la.user_id 
      AND ns.notification_type = 'daily_summary'
      AND ns.enabled = 1
    WHERE la.notify_enabled = 1 
      AND la.deleted_at IS NULL
  `;
  
  const accountsResult = await db
    .prepare(query)
    .all<{ line_user_id: string; user_id: number; settings: string }>();

  if (accountsResult.results.length === 0) return [];

  return accountsResult.results.map(row => {
    let settings: DailySummarySettings = {
      sendTime: '08:00',
      showBalance: true,
      showIncome: true,
      showExpense: true,
      showPending: true,
      showOverdue: true,
    };

    try {
      if (row.settings) {
        settings = JSON.parse(row.settings);
      }
    } catch {
      // Use default
    }

    return {
      lineUserId: row.line_user_id,
      userId: row.user_id,
      settings,
    };
  });
}

// ============================================================
// LINE API
// ============================================================

const LINE_API_BASE = 'https://api.line.me/v2/bot';

async function sendLineMessage(
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
      console.error(`[${WORKER_NAME}] LINE API error: ${response.status} ${errorBody}`);
      return { success: false, lineUserId, error: `LINE API ${response.status}` };
    }

    return { success: true, lineUserId };
  } catch (error) {
    console.error(`[${WORKER_NAME}] Send error:`, error);
    return { success: false, lineUserId, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================
// MESSAGE FORMATTING - Same as line-notify.ts
// ============================================================

function formatDailySummaryMessage(
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
    const netSign = metrics.monthlyNet >= 0 ? '+' : '';
    lines.push(netEmoji + ' สุทธิเดือนนี้');
    lines.push('   ' + netSign + fmt(metrics.monthlyNet) + ' บาท');
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

function getCurrentBangkokTimeString(): string {
  return getBangkokTime().timeString;
}

function getBangkokDateString(): string {
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
