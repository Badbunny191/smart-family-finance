/**
 * LINE Flex Message Sender
 * 
 * Functions to send Flex Messages via LINE Messaging API.
 * Used by:
 * - LINE Cron Service (scheduled notifications)
 * - Test send functionality
 */

import { buildDailySummaryFlexMessage } from './line-flex-message';

// ============================================================
// TYPES (matching line-flex-message.ts)
// ============================================================

export interface LineNotificationItem {
  title: string;
  amount: number;
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
  pendingItems: LineNotificationItem[];
  overdueItems: LineNotificationItem[];
}

export interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
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

/**
 * Send Flex Message to LINE user
 */
export async function sendFlexMessage(
  lineUserId: string,
  flexMessage: any,
  accessToken: string
): Promise<SendResult> {
  const requestPayload = {
    to: lineUserId,
    messages: [
      {
        type: 'flex',
        altText: '📊 Smart Family Finance - สรุปรายวัน',
        contents: flexMessage,
      },
    ],
  };

  console.log('\n========== LINE FLEX DEBUG ==========');
  console.log('📤 Request payload (without token):', JSON.stringify(requestPayload, null, 2));
  console.log('======================================\n');

  try {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const statusCode = response.status;
    const responseBody = await response.text();

    console.log('\n========== LINE API RESPONSE ==========');
    console.log('HTTP Status:', statusCode);
    console.log('Response body:', responseBody);
    console.log('========================================\n');

    if (!response.ok) {
      return { success: false, lineUserId, error: `LINE API error ${statusCode}: ${responseBody}` };
    }

    return { success: true, lineUserId };
  } catch (error) {
    console.error(`[LINE Flex] Network error for ${lineUserId}:`, error);
    return { success: false, lineUserId, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Build Flex Message and send to LINE user
 * Convenience function that combines building and sending
 */
export async function sendDailySummaryFlexToUser(
  lineUserId: string,
  metrics: LineNotificationMetrics,
  settings: DailySummarySettings,
  accessToken: string
): Promise<SendResult> {
  const flexMessage = buildDailySummaryFlexMessage(
    {
      totalBalance: metrics.totalBalance,
      monthlyIncome: metrics.monthlyIncome,
      monthlyExpense: metrics.monthlyExpense,
      monthlyNet: metrics.monthlyNet,
      pendingCount: metrics.pendingCount,
      pendingTotal: metrics.pendingTotal,
      overdueCount: metrics.overdueCount,
      overdueTotal: metrics.overdueTotal,
      pendingItems: metrics.pendingItems,
      overdueItems: metrics.overdueItems,
    },
    {
      sendTime: settings.sendTime,
      showBalance: settings.showBalance,
      showIncome: settings.showIncome,
      showExpense: settings.showExpense,
      showPending: settings.showPending,
      showOverdue: settings.showOverdue,
      showPendingDetails: settings.showPendingDetails,
      showOverdueDetails: settings.showOverdueDetails,
    }
  );

  return sendFlexMessage(lineUserId, flexMessage, accessToken);
}

/**
 * Send Flex Message with retry on rate limit (429)
 */
export async function sendFlexMessageWithRetry(
  lineUserId: string,
  flexMessage: any,
  accessToken: string,
  maxRetries: number = 2
): Promise<SendResult> {
  let lastError: SendResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendFlexMessage(lineUserId, flexMessage, accessToken);
      if (result.success) return result;
      
      // Rate limit - retry after waiting
      if (result.error?.includes('429') && attempt < maxRetries) {
        console.warn(`[LINE Flex] Rate limited, waiting 60s before retry ${attempt}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 60_000));
        lastError = { success: false, lineUserId, error: 'Rate limited, retried' };
        continue;
      }
      
      return result;
    } catch (error) {
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
