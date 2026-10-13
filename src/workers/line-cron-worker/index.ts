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
 * │   - DELEGATES to line-cron-service.ts as Single Source of Truth │
 * │   - Uses slot-level dedup via _slotHistory                  │
 * │   - Supports Multi-Send Time (08:35, 16:00, 19:00, etc.)   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * REVISION (v2 - Multi-Send Time + Slot-Level Dedup):
 * - Delegates to runLineCron() from line-cron-service.ts
 * - Uses filterRecipientsByTimeAndDedup() internally for time + dedup
 * - Uses updateLastSentAtAndHistory() internally for slot-level tracking
 * - Each slot can be sent independently on the same day
 */

import {
  runLineCron,
  getLineNotificationMetrics,
  getEnabledRecipients,
  getCurrentBangkokTimeString,
  getBangkokDateString,
  type LineNotificationMetrics,
  type LineRecipient,
} from '../../lib/line-cron-service';
import {
  effectiveSlots,
  readSlotHistory,
} from '../../lib/line-multi-send-time';

// ============================================================
// TYPES
// ============================================================

export interface Env {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

const WORKER_NAME = 'smart-family-finance-line-cron';

// ============================================================
// CLOUDFLARE WORKER EXPORTS
// ============================================================

export default {
  /**
   * scheduled() - Triggered every minute by Cloudflare Cron
   *
   * Uses the shared runLineCron() from line-cron-service.ts
   * which handles:
   * - Time matching (Asia/Bangkok)
   * - Slot-level dedup via _slotHistory
   * - Multi-send support (08:35, 16:00, 19:00, etc.)
   * - Updates _slotHistory after successful sends
   */
  async scheduled(
    event: { scheduledTime: number; cron: string },
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();

    console.log(`[${WORKER_NAME}] ============================================`);
    console.log(`[${WORKER_NAME}] CRON TRIGGER: ${new Date(event.scheduledTime).toISOString()}`);

    try {
      if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.DB) {
        console.error(`[${WORKER_NAME}] Missing required bindings`);
        throw new Error('Missing required bindings');
      }

      // DELEGATE to line-cron-service.ts
      // This function handles ALL logic:
      // 1. Gets dashboard metrics
      // 2. Gets enabled recipients with settings
      // 3. filterRecipientsByTimeAndDedup() - matches time slots + slot-level dedup
      // 4. Sends Flex Messages
      // 5. updateLastSentAtAndHistory() - updates _slotHistory after success
      const result = await runLineCron(env.DB, env.LINE_CHANNEL_ACCESS_TOKEN);

      const elapsed = Date.now() - startTime;

      if (result.skipped) {
        console.log(`[${WORKER_NAME}] ⏭️ Skipped: ${result.skipped.reason} (${elapsed}ms)`);
      } else {
        console.log(
          `[${WORKER_NAME}] ✅ Sent ${result.summary.totalSent}/${result.summary.totalRecipients} messages`
        );
        console.log(
          `[${WORKER_NAME}]    Failed: ${result.summary.totalFailed}, Skipped: ${result.summary.totalSkipped}`
        );
      }
      console.log(`[${WORKER_NAME}] ============================================`);
    } catch (error) {
      console.error(`[${WORKER_NAME}] ❌ Error:`, error);
      throw error;
    }
  },

  /**
   * fetch() - Health check, info, and debug endpoints
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        worker: WORKER_NAME,
        timestamp: new Date().toISOString(),
      });
    }

    // Debug endpoint - shows current time + slot history for each recipient
    if (url.pathname === '/debug') {
      const currentThaiTime = getCurrentBangkokTimeString();
      const currentBangkokDate = getBangkokDateString();

      let recipients: LineRecipient[] = [];
      let metrics: LineNotificationMetrics | null = null;

      try {
        recipients = await getEnabledRecipients(env.DB);
        metrics = await getLineNotificationMetrics(env.DB);
      } catch (e) {
        console.error('Failed to fetch data:', e);
      }

      // Show slot history for each recipient
      const recipientDebug = recipients.map((r) => {
        const history = readSlotHistory(r.settings);
        const slots = effectiveSlots(r.settings);
        const sentToday = history[currentBangkokDate] ?? [];

        return {
          lineUserId: r.lineUserId,
          sendTime: r.settings.sendTime,
          additionalTimes: (r.settings as { additionalTimes?: string[] }).additionalTimes ?? [],
          allSlots: slots,
          sentToday,
          historyKeys: Object.keys(history),
        };
      });

      return Response.json(
        {
          workerName: WORKER_NAME,
          currentUTC: new Date().toISOString(),
          currentBangkokTime: currentThaiTime,
          currentBangkokDate,
          recipientCount: recipients.length,
          recipients: recipientDebug,
          metrics: metrics
            ? {
                totalBalance: metrics.totalBalance,
                monthlyIncome: metrics.monthlyIncome,
                monthlyExpense: metrics.monthlyExpense,
                pendingCount: metrics.pendingCount,
                overdueCount: metrics.overdueCount,
              }
            : null,
        },
        { indent: 2 }
      );
    }

    // Info endpoint with full metrics
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
        currentBangkokDate,
        hasAccessToken: !!env.LINE_CHANNEL_ACCESS_TOKEN,
        databaseBinding: !!env.DB,
        metrics,
      });
    }

    return Response.json(
      {
        error: 'Not found',
        paths: ['/health', '/info', '/debug'],
      },
      { status: 404 }
    );
  },
};
