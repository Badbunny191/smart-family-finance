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
 * │   LINE Cron Worker (ES Module)                              │
 * │   - Has scheduled() export (required by Cloudflare)        │
 * │   - Has fetch() for health check                           │
 * │   - Uses D1 database with Drizzle ORM                      │
 * │   - Same business logic as Dashboard / Test Send           │
 * │   - SENDS FLEX MESSAGE (not text)                          │
 * │   - DEDUP via last_sent_at (Asia/Bangkok date)             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte, lt, isNull, inArray, sql, or } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { buildDailySummaryFlexMessage } from '../../lib/line-flex-message';
import { sendFlexMessage } from '../../lib/line-flex-sender';

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

interface LineNotificationItem {
  title: string;
  amount: number;
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
  pendingItems: LineNotificationItem[];
  overdueItems: LineNotificationItem[];
}

interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
}

interface RecipientWithSettings {
  lineUserId: string;
  userId: string | null;
  settings: DailySummarySettings;
  lastSentAt: number | null;
}

interface SendResult {
  success: boolean;
  lineUserId: string;
  error?: string;
  skipped?: string;
}

interface CronResult {
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
        console.log(
          `[${WORKER_NAME}] Sent ${result.summary.totalSent}/${result.summary.totalRecipients} messages (${elapsed}ms, skipped=${result.summary.totalSkipped})`
        );
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

    return Response.json(
      {
        error: 'Not found',
        paths: ['/health', '/info'],
      },
      { status: 404 }
    );
  },
};

// ============================================================
// CRON LOGIC
// ============================================================

async function runLineCron(
  db: D1Database,
  LINE_ACCESS_TOKEN: string
): Promise<CronResult> {
  const timestamp = new Date().toISOString();

  // 1. Get Dashboard Metrics (SAME as Dashboard/Test Send) — with items for Flex
  const metrics = await getLineNotificationMetrics(db);

  // 2. Get recipients with per-user settings (and last_sent_at for dedup)
  const recipients = await getEnabledRecipients(db);

  if (recipients.length === 0) {
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

  // 3. Filter by Thai time AND daily dedup
  const currentThaiTime = getCurrentBangkokTimeString();
  const currentBangkokDate = getBangkokDateString();
  const bangkokTimeParts = getBangkokTime();

  const toSend: RecipientWithSettings[] = [];
  const skippedByDedup: RecipientWithSettings[] = [];

  for (const recipient of recipients) {
    const configuredTime = recipient.settings?.sendTime || '08:00';
    const [configHour, configMinute] = configuredTime.split(':').map(Number);

    const match = bangkokTimeParts.hour === configHour && bangkokTimeParts.minute === configMinute;
    if (!match) continue;

    // Dedup: skip if already sent today (Asia/Bangkok)
    if (recipient.lastSentAt) {
      const lastSentBangkokDate = bangkokDateFromUnixSeconds(recipient.lastSentAt);
      if (lastSentBangkokDate === currentBangkokDate) {
        console.log(
          `[${WORKER_NAME}] Skip ${recipient.lineUserId}: already sent on ${lastSentBangkokDate}`
        );
        skippedByDedup.push(recipient);
        continue;
      }
    }

    toSend.push(recipient);
  }

  if (toSend.length === 0) {
    return {
      success: true,
      timestamp,
      sentAt: currentBangkokDate,
      metrics,
      recipients: skippedByDedup.map((r) => ({
        lineUserId: r.lineUserId,
        sent: false,
        skipped: 'already sent today',
      })),
      summary: {
        totalRecipients: recipients.length,
        totalSent: 0,
        totalFailed: 0,
        totalSkipped: skippedByDedup.length,
      },
      skipped: { reason: `No recipients for ${currentThaiTime} (or all already sent today)` },
    };
  }

  // 4. Send FLEX MESSAGES
  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const recipient of toSend) {
    const flexMessage = buildDailySummaryFlexMessage(metrics, recipient.settings);
    const result = await sendFlexMessage(recipient.lineUserId, flexMessage, LINE_ACCESS_TOKEN);
    results.push(result);

    if (result.success) {
      totalSent++;
      // Update last_sent_at only on successful send
      if (recipient.userId) {
        try {
          await updateLastSentAt(db, recipient.userId);
        } catch (e) {
          console.warn(`[${WORKER_NAME}] Failed to update last_sent_at for ${recipient.userId}:`, e);
        }
      }
    } else {
      totalFailed++;
      console.error(
        `[${WORKER_NAME}] Failed to send to user_id=${recipient.userId}: ${result.error}`
      );
    }
  }

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
      ...skippedByDedup.map((r) => ({
        lineUserId: r.lineUserId,
        sent: false,
        skipped: 'already sent today',
      })),
    ],
    summary: {
      totalRecipients: recipients.length,
      totalSent,
      totalFailed,
      totalSkipped: skippedByDedup.length,
    },
    skipped: null,
  };
}

// ============================================================
// DATABASE QUERIES
// ============================================================

function getCurrentMonthRange(): { monthStart: Date; nextMonthStart: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

/**
 * Update last_sent_at after successful send (used for daily dedup).
 */
async function updateLastSentAt(db: D1Database, userId: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE notification_settings
       SET last_sent_at = ?, updated_at = ?
       WHERE user_id = ? AND notification_type = 'daily_summary'`
    )
    .bind(nowSec, nowSec, userId)
    .run();
}

/**
 * Get metrics for LINE notification — same as dashboard/test-send,
 * plus top-5 items for the Flex Message.
 */
async function getLineNotificationMetrics(db: D1Database): Promise<LineNotificationMetrics> {
  const { monthStart, nextMonthStart } = getCurrentMonthRange();

  const drizzleDb = drizzle(db, { schema });

  // Total Balance
  const balanceResult = await drizzleDb
    .select({
      totalBalance: sql<number>`COALESCE(SUM(${schema.accounts.currentBalance}), 0)`,
    })
    .from(schema.accounts)
    .where(
      and(
        inArray(schema.accounts.accountType, ['cash', 'bank']),
        isNull(schema.accounts.deletedAt)
      )
    );

  // Monthly income/expense
  const incomeExpenseResult = await drizzleDb
    .select({
      type: schema.transactions.type,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.status, 'completed'),
        gte(schema.transactions.date, monthStart),
        lt(schema.transactions.date, nextMonthStart),
        or(
          eq(schema.transactions.type, 'income'),
          eq(schema.transactions.type, 'expense')
        ),
        isNull(schema.transactions.deletedAt)
      )
    )
    .groupBy(schema.transactions.type);

  // Pending (not yet overdue)
  const pendingResult = await drizzleDb
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.type, 'income'),
        eq(schema.transactions.businessStatus, 'pending'),
        isNull(schema.transactions.deletedAt),
        sql`datetime(datetime(${schema.transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
      )
    );

  // Overdue
  const overdueResult = await drizzleDb
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.type, 'income'),
        eq(schema.transactions.businessStatus, 'pending'),
        isNull(schema.transactions.deletedAt),
        sql`datetime(datetime(${schema.transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
      )
    );

  // Pending items (top 5 oldest)
  const pendingItemsResult = await drizzleDb
    .select({
      title: schema.transactions.title,
      amount: schema.transactions.amount,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.type, 'income'),
        eq(schema.transactions.businessStatus, 'pending'),
        isNull(schema.transactions.deletedAt),
        sql`datetime(datetime(${schema.transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')`
      )
    )
    .orderBy(schema.transactions.date)
    .limit(5);

  // Overdue items (top 5 oldest)
  const overdueItemsResult = await drizzleDb
    .select({
      title: schema.transactions.title,
      amount: schema.transactions.amount,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.type, 'income'),
        eq(schema.transactions.businessStatus, 'pending'),
        isNull(schema.transactions.deletedAt),
        sql`datetime(datetime(${schema.transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')`
      )
    )
    .orderBy(schema.transactions.date)
    .limit(5);

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
    pendingItems: pendingItemsResult.map((it) => ({
      title: it.title,
      amount: Number(it.amount) || 0,
    })),
    overdueItems: overdueItemsResult.map((it) => ({
      title: it.title,
      amount: Number(it.amount) || 0,
    })),
  };
}

/**
 * Get all enabled LINE recipients with their per-user settings and last_sent_at.
 */
async function getEnabledRecipients(db: D1Database): Promise<RecipientWithSettings[]> {
  const query = `
    SELECT
      la.line_user_id,
      la.user_id,
      COALESCE(ns.settings, '{"sendTime":"08:00","showBalance":true,"showIncome":true,"showExpense":true,"showPending":true,"showOverdue":true,"showPendingDetails":true,"showOverdueDetails":true}') as settings,
      ns.last_sent_at as last_sent_at
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
    .all<{
      line_user_id: string;
      user_id: string | number | null;
      settings: string;
      last_sent_at: number | null;
    }>();

  if (accountsResult.results.length === 0) return [];

  return accountsResult.results.map((row) => {
    let settings: DailySummarySettings = {
      sendTime: '08:00',
      showBalance: true,
      showIncome: true,
      showExpense: true,
      showPending: true,
      showOverdue: true,
      showPendingDetails: true,
      showOverdueDetails: true,
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
      userId: row.user_id != null ? String(row.user_id) : null,
      settings,
      lastSentAt: row.last_sent_at ?? null,
    };
  });
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
  const day = parts.find((p) => p.type === 'day')?.value || '00';
  const month = parts.find((p) => p.type === 'month')?.value || '00';
  const yearCE = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
  const yearBE = yearCE + 543;

  return `${day}/${month}/${yearBE}`;
}

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
