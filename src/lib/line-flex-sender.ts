/**
 * LINE Flex Message Sender
 * 
 * Functions to send Flex Messages via LINE Messaging API.
 * Used by:
 * - LINE Cron Service (scheduled notifications)
 * - Test send functionality
 */

import { buildFlexMessage, LineFlexMetrics, TransactionItem } from './line-flex-builder';

// ============================================================
// TYPES (compatible with line-cron-service.ts)
// ============================================================

export interface LineNotificationItem {
  title: string;
  amount: number;
}

export interface TodaySummary {
  receivedCount: number;
  receivedAmount: number;
  paidCount: number;
  paidAmount: number;
}

export interface LineNotificationMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  // Income (รอรับเงิน / รับเงินเกินกำหนด)
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  // Expense (รอจ่าย / จ่ายเงินเกินกำหนด)
  pendingPayCount: number;
  pendingPayAmount: number;
  overduePayCount: number;
  overduePayAmount: number;
  // Items for Flex details
  pendingItems?: Array<{ title: string; amount: number }>;
  overdueItems?: Array<{ title: string; amount: number }>;
  pendingPayItems?: Array<{ title: string; amount: number }>;
  overduePayItems?: Array<{ title: string; amount: number }>;
  today: TodaySummary;  // today's completed transactions
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
 * Convert LineNotificationMetrics (from line-cron-service) to LineFlexMetrics (for line-flex-builder)
 * 
 * LineNotificationMetrics has:
 * - pendingItems (income)
 * - overdueItems (income)
 * - today: receivedCount, receivedAmount, paidCount, paidAmount
 * 
 * LineFlexMetrics needs:
 * - pendingReceive, pendingPay
 * - overdueReceive, overduePay
 * - today: same structure
 * 
 * Since line-flex-builder expects separate receive/pay arrays,
 * we put everything in the receive arrays (pendingItems/overdueItems are income-based)
 * 
 * EXPORTED so that Preview / Test-Send / Cron all share the same conversion logic.
 */
export function toFlexMetrics(metrics: LineNotificationMetrics): LineFlexMetrics {
  return {
    totalBalance: metrics.totalBalance,
    monthly: {
      income: metrics.monthlyIncome,
      expense: metrics.monthlyExpense,
    },
    // Use real today data from database query
    today: {
      receivedCount: metrics.today.receivedCount,
      receivedAmount: metrics.today.receivedAmount,
      paidCount: metrics.today.paidCount,
      paidAmount: metrics.today.paidAmount,
    },
    // Receive = income
    overdueReceive: (metrics.overdueItems ?? []).map(item => ({
      title: item.title,
      amount: item.amount,
    })),
    pendingReceive: (metrics.pendingItems ?? []).map(item => ({
      title: item.title,
      amount: item.amount,
    })),
    // Pay = expense (map จาก metrics จริง ไม่ hardcode แล้ว)
    overduePay: (metrics.overduePayItems ?? []).map(item => ({
      title: item.title,
      amount: item.amount,
    })),
    pendingPay: (metrics.pendingPayItems ?? []).map(item => ({
      title: item.title,
      amount: item.amount,
    })),
  };
}

/**
 * Build Flex Message and send to LINE user
 * Uses the new flex builder with dynamic data from database
 */
export async function sendDailySummaryFlexToUser(
  lineUserId: string,
  metrics: LineNotificationMetrics,
  settings: DailySummarySettings,
  accessToken: string
): Promise<SendResult> {
  // Convert from LineNotificationMetrics to LineFlexMetrics
  const flexMetrics = toFlexMetrics(metrics);

  console.log('[AUTO SEND FINAL METRICS]', {
    monthlyIncome: flexMetrics.monthly.income,
    monthlyExpense: flexMetrics.monthly.expense,
    monthlyNet: flexMetrics.monthly.income - flexMetrics.monthly.expense,
    totalBalance: flexMetrics.totalBalance,
    today: flexMetrics.today,
  });
  
  // Backward compat: ถ้า settings เก่ามี showOverdue/showPending → map เป็น 2 ฝั่ง
  const legacyShow = settings.showOverdue ?? true;
  const legacyPending = settings.showPending ?? true;
  
  // 🚨 AUDIT: Log settings.showToday
  console.log('[ManualSend] settings.showToday:', (settings as any).showToday);
  console.log('[ManualSend] final flexSettings:', {
    sendTime: settings.sendTime,
    showBalance: settings.showBalance ?? true,
    showMonthly: settings.showIncome ?? true,
    showToday: (settings as any).showToday ?? false,
    showOverdueReceive: (settings as any).showOverdueReceive ?? legacyShow,
    showOverduePay: (settings as any).showOverduePay ?? legacyShow,
    showPendingReceive: (settings as any).showPendingReceive ?? legacyPending,
    showPendingPay: (settings as any).showPendingPay ?? legacyPending,
  });
  
  const flexMessage = buildFlexMessage(flexMetrics, {
    sendTime: settings.sendTime,
    showBalance: settings.showBalance ?? true,
    showMonthly: settings.showIncome ?? true,
    showToday: (settings as any).showToday ?? false,
    showOverdueReceive: (settings as any).showOverdueReceive ?? legacyShow,
    showOverduePay: (settings as any).showOverduePay ?? legacyShow,
    showPendingReceive: (settings as any).showPendingReceive ?? legacyPending,
    showPendingPay: (settings as any).showPendingPay ?? legacyPending,
  });

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
