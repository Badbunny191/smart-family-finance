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
 * │   - Uses D1 database via line-cron-service.ts               │
 * │   - SHARES Single Source of Truth with Preview/Test-Send   │
 * │   - Same business logic as Dashboard / Test Send           │
 * │   - SENDS FLEX MESSAGE (not text)                          │
 * │   - DEDUP via last_sent_at (Asia/Bangkok date)             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte, lt, isNull, inArray, sql, or } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { buildFlexMessage } from '../../lib/line-flex-builder';
import { sendFlexMessage, toFlexMetrics } from '../../lib/line-flex-sender';
import { getLineNotificationMetrics, getEnabledRecipients, LineRecipient, LineNotificationMetrics } from '../../lib/line-cron-service';

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

interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showToday?: boolean;
  showOverdueReceive?: boolean;
  showOverduePay?: boolean;
  showPendingReceive?: boolean;
  showPendingPay?: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
  showPending?: boolean;
  showOverdue?: boolean;
}

// Use LineRecipient from line-cron-service (aliased for clarity)
type RecipientWithSettings = LineRecipient;

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

  // ============================================================
  // DEBUG LOG 1: Current Time Info
  // ============================================================
  const currentThaiTime = getCurrentBangkokTimeString();
  const currentBangkokDate = getBangkokDateString();
  const bangkokTimeParts = getBangkokTime();

  // 1. Get Dashboard Metrics
  const metrics = await getLineNotificationMetrics(db);

  // 2. Get recipients with per-user settings (and last_sent_at for dedup)
  const recipients = await getEnabledRecipients(db);

  if (recipients.length === 0) {
    console.log(`[${WORKER_NAME}] No enabled recipients found`);
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

  console.log(`[${WORKER_NAME}] Found ${recipients.length} enabled recipients`);

  // 3. Filter by Thai time AND daily dedup
  const toSend: RecipientWithSettings[] = [];
  const skippedByDedup: RecipientWithSettings[] = [];

  for (const recipient of recipients) {
    const configuredTime = recipient.settings?.sendTime || '08:00';
    const sendTime = configuredTime;
    const additionalTimes = (recipient.settings as { additionalTimes?: string[] })?.additionalTimes ?? [];

    // Time match check (with 60-second window)
    const now = new Date();

    // Build full list of slots (sendTime + additionalTimes)
    const allSlots = Array.from(new Set([sendTime, ...additionalTimes].filter(Boolean)));
    const matched = isAnyTimeMatchWindow(allSlots, now);

    if (!matched.matched) {
      continue;
    }

    // Dedup with sendTime check: skip only if sent today AND matchedTime unchanged
    if (recipient.lastSentAt) {
      const lastSentBangkokDate = bangkokDateFromUnixSeconds(recipient.lastSentAt);
      const lastSentDate = new Date(recipient.lastSentAt * 1000);

      // Get Bangkok time when last sent
      const lastSentFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const lastSentParts = lastSentFormatter.formatToParts(lastSentDate);
      const lastSentHour = parseInt(lastSentParts.find((p) => p.type === 'hour')?.value || '0', 10);
      const lastSentMinute = parseInt(lastSentParts.find((p) => p.type === 'minute')?.value || '0', 10);
      const lastSentTime = `${lastSentHour}:${lastSentMinute}`;

      // Normalize both times to HH:MM format for comparison
      const normalizeTime = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return `${h}:${m.toString().padStart(2, '0')}`;
      };

      const normalizedLastSentTime = normalizeTime(lastSentTime);
      const normalizedMatchedTime = normalizeTime(matched.matchedTime || configuredTime);

      if (lastSentBangkokDate === currentBangkokDate) {
        if (normalizedLastSentTime === normalizedMatchedTime) {
          skippedByDedup.push(recipient);
          continue;
        }
      }
    }

    toSend.push(recipient);
  }

  // Summary
  const totalSkipped = recipients.length - toSend.length;
  console.log(`[${WORKER_NAME}] Cron completed: ${toSend.length} to send, ${totalSkipped} skipped, ${recipients.length} total recipients`);

  if (toSend.length === 0) {
    return {
      success: true,
      timestamp,
      sentAt: currentBangkokDate,
      metrics,
      recipients: [],
      summary: {
        totalRecipients: recipients.length,
        totalSent: 0,
        totalFailed: 0,
        totalSkipped: recipients.length,
      },
      skipped: {
        reason: recipients.length > 0 ? 'all recipients skipped by time or dedup' : 'no recipients found',
      },
    };
  }

  // 4. Send FLEX MESSAGES
  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  // 🚨 AUDIT: Dump metrics before send loop
  console.log(`[${WORKER_NAME}] metrics.today:`, JSON.stringify({
    receivedCount: metrics.today.receivedCount,
    receivedAmount: metrics.today.receivedAmount,
    paidCount: metrics.today.paidCount,
    paidAmount: metrics.today.paidAmount,
  }));

  for (const recipient of toSend) {
    // Backward compat: ถ้า settings เก่ามี showOverdue/showPending → map เป็น 2 ฝั่ง
    const legacyShow = recipient.settings.showOverdue ?? true;
    const legacyPending = recipient.settings.showPending ?? true;

    // 🚨 AUDIT: Log metrics and settings before buildFlexMessage
    console.log(`[${WORKER_NAME}] ============================================`);
    console.log(`[${WORKER_NAME}] TODAY_METRICS:`, JSON.stringify({
      receivedCount: metrics.today.receivedCount,
      receivedAmount: metrics.today.receivedAmount,
      paidCount: metrics.today.paidCount,
      paidAmount: metrics.today.paidAmount,
    }));
    console.log(`[${WORKER_NAME}] SETTINGS.showToday:`, (recipient.settings as any).showToday);
    console.log(`[${WORKER_NAME}] recipient.settings:`, JSON.stringify(recipient.settings));
    
    // Convert LineNotificationMetrics → LineFlexMetrics using shared function
    const flexMetrics = toFlexMetrics(metrics);
    
    console.log(`[${WORKER_NAME}] FLEX_METRICS.today:`, JSON.stringify(flexMetrics.today));
    
    // Use new flex builder with new metrics format
    const flexSettings = {
      sendTime: recipient.settings.sendTime,
      showBalance: recipient.settings.showBalance,
      showMonthly: recipient.settings.showIncome,
      showToday: true,
      showOverdueReceive: (recipient.settings as any).showOverdueReceive ?? legacyShow,
      showOverduePay: (recipient.settings as any).showOverduePay ?? legacyShow,
      showPendingReceive: (recipient.settings as any).showPendingReceive ?? legacyPending,
      showPendingPay: (recipient.settings as any).showPendingPay ?? legacyPending,
    };
    console.log(`[${WORKER_NAME}] FLEX_SETTINGS:`, JSON.stringify(flexSettings));
    
    const flexMessage = buildFlexMessage(flexMetrics, flexSettings);
    
    // Log final payload
    console.log(`[${WORKER_NAME}] FINAL_PAYLOAD:`, JSON.stringify(flexMessage, null, 2));
    console.log(`[${WORKER_NAME}] ============================================`);
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
// TIME MATCHING (with 60-second window)
// ============================================================

// ============================================================
// TIME MATCHING (with 60-second window)
// ============================================================

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
 * Check if current time matches configured time within a 60-second window.
 * This handles cases where cron executes at seconds :01-:59 of the target minute.
 *
 * Example:
 * - configuredTime = "11:30"
 * - cron executes at 11:30:51 -> matches (within 60-second window)
 * - cron executes at 11:31:00 -> does NOT match (new minute)
 */
function isTimeMatchWindow(configuredTime: string, now: Date): boolean {
  // Get UTC timestamp
  const utcMs = now.getTime();

  // Get Bangkok time using Intl WITH second to avoid rounding
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const bangkokHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const bangkokMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const bangkokSecond = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
  const normalizedBangkokHour = bangkokHour === 24 ? 0 : bangkokHour;

  // Calculate configured time as minutes from midnight
  const [configHour, configMinute] = configuredTime.split(':').map(Number);
  const configMinutesFromMidnight = configHour * 60 + configMinute;
  const currentMinutesFromMidnight = normalizedBangkokHour * 60 + bangkokMinute;

  // Debug: Calculate timestamp difference
  const configBangkokMs = utcMs + (7 * 60 * 60 * 1000) - (bangkokMinute * 60 * 1000) - (bangkokSecond * 1000);
  const targetMinuteStartMs = configBangkokMs + (configMinute * 60 * 1000);
  const diffSeconds = Math.floor((utcMs - targetMinuteStartMs + (7 * 60 * 60 * 1000)) / 1000);

  // Time window: sendTime <= now < sendTime + 60 seconds
  // Cron at 12:50:51 should match sendTime 12:50 (diff = 51 seconds)
  if (currentMinutesFromMidnight === configMinutesFromMidnight) {
    return true;
  }

  return false;
}

/**
 * Check if current time matches ANY of the provided times (sendTime + additionalTimes).
 * Delegates to isTimeMatchWindow for each time slot — original matching logic unchanged.
 */
function isAnyTimeMatchWindow(times: string[], now: Date): { matched: boolean; matchedTime: string | null } {
  for (const t of times) {
    if (isTimeMatchWindow(t, now)) {
      return { matched: true, matchedTime: t };
    }
  }
  return { matched: false, matchedTime: null };
}

/**
 * Get Bangkok time components from a Date object.
 */
function getBangkokTimeFromDate(date: Date): { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
  const normalizedHour = hour === 24 ? 0 : hour;

  return { hour: normalizedHour, minute, second };
}

// ============================================================
// TIME HELPERS (Asia/Bangkok)
// ============================================================

function getBangkokTime(): { hour: number; minute: number; timeString: string } {
  // Use raw timestamp calculation to avoid Intl.DateTimeFormat rounding issue
  // Intl without second field will round minute when second >= 30
  // Bangkok is UTC+7
  const now = Date.now();
  const bangkokMs = now + (7 * 60 * 60 * 1000); // UTC + 7 hours
  const totalMinutes = Math.floor(bangkokMs / (60 * 1000));
  const hour = Math.floor((totalMinutes / 60) % 24);
  const minute = totalMinutes % 60;

  return {
    hour,
    minute,
    timeString: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
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
