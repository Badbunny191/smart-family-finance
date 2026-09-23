/**
 * LINE Notification Service
 * 
 * Handles LINE Messaging API push for daily summaries.
 * Used by:
 * - LINE Daily Summary cron (src/app/api/line-notify/cron/route.ts)
 */

import { formatCurrency } from '@/lib/utils';

// ============================================================
// TYPES
// ============================================================

export interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;       // show monthly net as separate toggle
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;   // show top-3 pending items
  showOverdueDetails: boolean;   // show top-3 overdue items
}

export interface LineNotificationMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  pendingItems: Array<{ title: string; amount: number }>;
  overdueItems: Array<{ title: string; amount: number }>;
}

export interface SendResult {
  success: boolean;
  lineUserId: string;
  error?: string;
}

// ============================================================
// LINE API
// ============================================================

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export interface LineBotInfo {
  userId: string;       // Bot's LINE user ID
  basicId: string;      // Bot's @-prefixed ID (e.g. @935bvyom)
  displayName: string;  // Bot's display name
  pictureUrl?: string;
  chatMode: string;     // 'bot' | 'native'
  markAsReadMode: string;
}

/**
 * Verify the LINE channel access token by calling /v2/bot/info
 * Returns bot info if valid, throws LINEApiError otherwise.
 */
export async function getLineBotInfo(accessToken: string): Promise<LineBotInfo> {
  const response = await fetch(`${LINE_API_BASE}/info`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new LINEApiError(
      `LINE API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  return (await response.json()) as LineBotInfo;
}

/**
 * Push message to LINE user using Messaging API
 */
async function pushMessage(lineUserId: string, message: string, accessToken: string): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new LINEApiError(
      `LINE API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    );
  }
}

/**
 * Custom error for LINE API errors
 */
export class LINEApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body: string
  ) {
    super(message);
    this.name = 'LINEApiError';
  }
}

// ============================================================
// MESSAGE FORMATTING
// ============================================================

/**
 * Format daily summary message for LINE
 * Uses settings to determine which metrics to show
 */
export function formatDailySummaryMessage(
  metrics: LineNotificationMetrics,
  settings: DailySummarySettings,
  dateString: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('📊 Smart Family Finance');
  lines.push(`วันที่ ${dateString}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━');

  // Balance
  if (settings.showBalance) {
    lines.push(`💰 คงเหลือรวม    ${formatCurrency(metrics.totalBalance)}`);
  }

  // Income & Expense
  if (settings.showIncome || settings.showExpense) {
    if (settings.showIncome) {
      lines.push(`📈 รายรับเดือนนี้  ${formatCurrency(metrics.monthlyIncome)}`);
    }
    if (settings.showExpense) {
      lines.push(`📉 รายจ่ายเดือนนี้  ${formatCurrency(metrics.monthlyExpense)}`);
    }
    if (settings.showNet) {
      lines.push('━━━━━━━━━━━━━━━━━━━━━━');
      const netSign = metrics.monthlyNet >= 0 ? '+' : '';
      lines.push(`✅ สุทธิ            ${netSign}${formatCurrency(metrics.monthlyNet)}`);
    }
  }

  // Pending & Overdue
  const hasPendingOrOverdue = settings.showPending || settings.showOverdue;
  if (hasPendingOrOverdue) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    if (settings.showPending) {
      const pendingText = metrics.pendingCount > 0
        ? `${metrics.pendingCount} รายการ  ${formatCurrency(metrics.pendingTotal)}`
        : '0 รายการ';
      lines.push(`⚠️ รอชำระ    ${pendingText}`);

      // Item details (top 3)
      if (settings.showPendingDetails && metrics.pendingCount > 0 && metrics.pendingItems) {
        const items = metrics.pendingItems.slice(0, 3);
        for (const item of items) {
          lines.push(`   • ${item.title}  ${formatCurrency(item.amount)}`);
        }
        const remaining = metrics.pendingCount - items.length;
        if (remaining > 0) {
          lines.push(`   และอีก ${remaining} รายการ...`);
        }
      }
    }
    if (settings.showOverdue) {
      const overdueText = metrics.overdueCount > 0
        ? `${metrics.overdueCount} รายการ  ${formatCurrency(metrics.overdueTotal)}`
        : '0 รายการ';
      lines.push(`🟥 เกินกำหนด  ${overdueText}`);

      // Item details (top 3)
      if (settings.showOverdueDetails && metrics.overdueCount > 0 && metrics.overdueItems) {
        const items = metrics.overdueItems.slice(0, 3);
        for (const item of items) {
          lines.push(`   • ${item.title}  ${formatCurrency(item.amount)}`);
        }
        const remaining = metrics.overdueCount - items.length;
        if (remaining > 0) {
          lines.push(`   และอีก ${remaining} รายการ...`);
        }
      }
    }
  }

  return lines.join('\n');
}

// ============================================================
// SEND FUNCTIONS
// ============================================================

/**
 * Send daily summary to a single LINE user
 */
export async function sendDailySummaryToUser(
  lineUserId: string,
  message: string,
  accessToken: string
): Promise<SendResult> {
  try {
    await pushMessage(lineUserId, message, accessToken);
    return { success: true, lineUserId };
  } catch (error) {
    if (error instanceof LINEApiError) {
      console.error(`LINE API error for ${lineUserId}: ${error.statusCode} ${error.body}`);
      return {
        success: false,
        lineUserId,
        error: `LINE API error: ${error.statusCode}`,
      };
    }
    console.error(`Failed to send to ${lineUserId}:`, error);
    return {
      success: false,
      lineUserId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send daily summary to multiple LINE users
 */
export async function sendDailySummaryToUsers(
  recipients: { lineUserId: string; settings: DailySummarySettings }[],
  metrics: LineNotificationMetrics,
  dateString: string,
  accessToken: string
): Promise<{ results: SendResult[]; totalSent: number; totalFailed: number }> {
  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const recipient of recipients) {
    // Format message based on recipient's settings
    const message = formatDailySummaryMessage(metrics, recipient.settings, dateString);

    // Send to this user
    const result = await sendDailySummaryToUser(recipient.lineUserId, message, accessToken);
    results.push(result);

    if (result.success) {
      totalSent++;
    } else {
      totalFailed++;
    }
  }

  return { results, totalSent, totalFailed };
}

// ============================================================
// RETRY LOGIC
// ============================================================

/**
 * Send with retry on rate limit (429)
 */
export async function sendWithRetry(
  lineUserId: string,
  message: string,
  accessToken: string,
  maxRetries: number = 2
): Promise<SendResult> {
  let lastError: SendResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pushMessage(lineUserId, message, accessToken);
      return { success: true, lineUserId };
    } catch (error) {
      if (error instanceof LINEApiError) {
        // Rate limit - retry after waiting
        if (error.statusCode === 429 && attempt < maxRetries) {
          console.warn(`Rate limited, waiting 60s before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 60_000));
          lastError = { success: false, lineUserId, error: 'Rate limited, retried' };
          continue;
        }
        
        // Other LINE API errors - don't retry
        lastError = { success: false, lineUserId, error: `LINE API error: ${error.statusCode}` };
        break;
      }
      
      // Network error - retry once
      if (attempt < maxRetries) {
        lastError = { success: false, lineUserId, error: 'Network error, retrying...' };
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      lastError = { success: false, lineUserId, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return lastError || { success: false, lineUserId, error: 'Max retries exceeded' };
}
