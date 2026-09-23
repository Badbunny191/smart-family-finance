/**
 * LINE Flex Message Builder
 * 
 * Creates rich Flex Messages for Smart Family Finance notifications.
 * Uses a modern Financial Dashboard design style (not traditional bank style).
 * 
 * Design Principles:
 * - Mobile-first with clean, scannable layout
 * - Financial Dashboard aesthetic with card-based UI
 * - Color coding: Green (positive), Yellow (pending), Red (overdue)
 * - Top 3 items for pending/overdue sections
 */

import { formatCurrency } from '@/lib/utils';

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
  pendingItems: Array<{ title: string; amount: number }>;
  overdueItems: Array<{ title: string; amount: number }>;
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

// ============================================================
// COLOR PALETTE (Light Banking App Theme)
// ============================================================

const COLORS = {
  // Surfaces (Light theme)
  background: '#FFFFFF',
  card: '#F8FAFC',
  cardAlt: '#F1F5F9',
  border: '#E2E8F0',
  
  // Text
  primary: '#0F172A',      // Slate 900 - main text
  secondary: '#475569',    // Slate 600 - secondary text
  muted: '#94A3B8',        // Slate 400 - muted text
  
  // Semantic - Income (green)
  positive: '#10B981',     // Emerald 500
  positiveDark: '#047857', // Emerald 700 (สุทธิ = เขียวเข้ม)
  positiveBg: '#ECFDF5',   // Emerald 50 (light)
  
  // Semantic - Expense (red)
  negative: '#DC2626',     // Red 600
  negativeBg: '#FEF2F2',   // Red 50 (light - เกินกำหนด)
  
  // Semantic - Pending (yellow)
  pending: '#D97706',      // Amber 600
  pendingBg: '#FFFBEB',    // Amber 50 (light - รอชำระ)
  
  // Brand
  accent: '#0EA5E9',       // Sky 500
};

// ============================================================
// FORMATTING HELPERS
// ============================================================

function formatAmount(amount: number): string {
  return formatCurrency(amount);
}

function truncateText(text: string, maxLength: number = 20): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function getDateHeader(): { date: string; dayName: string; monthYear: string; time: string } {
  const now = new Date();
  const bangkokFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  const dayFormatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
  });
  
  const monthYearFormatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    month: 'long',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const dateStr = bangkokFormatter.format(now);
  const dayName = dayFormatter.format(now);
  const monthYear = monthYearFormatter.format(now);
  const timeStr = timeFormatter.format(now);
  
  // Convert Gregorian year (CE) to Buddhist Era (BE) for the date line only
  // e.g. 2026 → 2569
  const dateParts = dateStr.split('/');
  if (dateParts.length === 3) {
    const ceYear = parseInt(dateParts[2], 10);
    if (!isNaN(ceYear)) {
      dateParts[2] = String(ceYear + 543);
    }
  }
  const dateBuddhist = dateParts.join('/');
  
  return { date: dateBuddhist, dayName, monthYear, time: timeStr };
}

// ============================================================
// FLEX MESSAGE BUILDER (Single Bubble)
// ============================================================

/**
 * Build a Single Bubble Flex Message with all sections:
 * 
 * Order (top to bottom):
 * 1. 💰 คงเหลือรวม
 * 2. 📈 รายรับเดือนนี้
 * 3. 📉 รายจ่ายเดือนนี้
 * 4. ✅ สุทธิ
 * 5. ──── (divider)
 * 6. 💳 สถานะการชำระเงิน
 * 7. 🚨 เกินกำหนด
 * 8. ⚠️ รอชำระ
 */
export function buildDailySummaryFlexMessage(
  metrics: LineNotificationMetrics,
  settings: DailySummarySettings
): any {
  const { dayName, monthYear, date, time } = getDateHeader();
  
  const bodyContents: any[] = [];
  
  // ========================================
  // 0. 📅 Date / 🕒 Time header
  // ========================================
  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '📅 วันที่ ' + date,
        color: COLORS.secondary,
        size: 'xs',
        align: 'start',
        gravity: 'center',
      },
      {
        type: 'text',
        text: '🕒 เวลา ' + time + ' น.',
        color: COLORS.secondary,
        size: 'xs',
        align: 'end',
      },
    ],
  });
  
  // ========================================
  // 1. 💰 คงเหลือรวม (Balance - Hero card)
  // ========================================
  if (settings.showBalance) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.card,
      cornerRadius: '12px',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: '💰 คงเหลือรวม',
          color: COLORS.secondary,
          size: 'sm',
          align: 'center',
        },
        {
          type: 'text',
          text: formatAmount(metrics.totalBalance),
          color: COLORS.primary,
          size: 'xl',
          weight: 'bold',
          align: 'center',
          margin: 'md',
        },
      ],
    });
  }
  
  // ========================================
  // 2. 📈 รายรับเดือนนี้ (Income row)
  // ========================================
  if (settings.showIncome) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: '📈 รายรับเดือนนี้',
          color: COLORS.positive,
          size: 'md',
          flex: 1,
        },
        {
          type: 'text',
          text: formatAmount(metrics.monthlyIncome),
          color: COLORS.positive,
          size: 'md',
          weight: 'bold',
          align: 'end',
        },
      ],
    });
  }
  
  // ========================================
  // 3. 📉 รายจ่ายเดือนนี้ (Expense row)
  // ========================================
  if (settings.showExpense) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: '📉 รายจ่ายเดือนนี้',
          color: COLORS.negative,
          size: 'md',
          flex: 1,
        },
        {
          type: 'text',
          text: formatAmount(metrics.monthlyExpense),
          color: COLORS.negative,
          size: 'md',
          weight: 'bold',
          align: 'end',
        },
      ],
    });
  }
  
  // ========================================
  // 4. ✅ สุทธิ (Net - dark green)
  // ========================================
  if (settings.showPending || settings.showOverdue) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: '✅ สุทธิ',
          color: COLORS.positiveDark,
          size: 'md',
          weight: 'bold',
          flex: 1,
        },
        {
          type: 'text',
          text: (metrics.monthlyNet >= 0 ? '+' : '') + formatAmount(metrics.monthlyNet),
          color: COLORS.positiveDark,
          size: 'lg',
          weight: 'bold',
          align: 'end',
        },
      ],
    });
  }
  
  // ========================================
  // 5. Divider
  // ========================================
  if ((settings.showBalance || settings.showIncome || settings.showExpense) && 
      (settings.showPending || settings.showOverdue)) {
    bodyContents.push({
      type: 'separator',
      margin: 'md',
      color: COLORS.border,
    });
  }
  
  // ========================================
  // 6. 💳 สถานะการชำระเงิน (Section header)
  // ========================================
  if (settings.showPending || settings.showOverdue) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.cardAlt,
      cornerRadius: '8px',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: '💳 สถานะการชำระเงิน',
          weight: 'bold',
          color: COLORS.primary,
          size: 'md',
        },
        {
          type: 'text',
          text: 'รายการที่ต้องติดตาม',
          color: COLORS.muted,
          size: 'xs',
          margin: 'sm',
        },
      ],
    });
  }
  
  // ========================================
  // 7. 🚨 เกินกำหนด (Overdue - FIRST per requirement)
  // ========================================
  if (settings.showOverdue) {
    const hasOverdueItems = metrics.overdueCount > 0 && metrics.overdueItems.length > 0;
    
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.negativeBg,
      cornerRadius: '8px',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: '🚨 เกินกำหนด',
          color: COLORS.negative,
          weight: 'bold',
          size: 'sm',
        },
        {
          type: 'text',
          text: metrics.overdueCount + ' รายการ',
          color: COLORS.negative,
          size: 'xs',
          margin: 'sm',
        },
        {
          type: 'text',
          text: formatAmount(metrics.overdueTotal),
          color: COLORS.negative,
          size: 'sm',
          weight: 'bold',
          margin: 'sm',
        },
        ...(hasOverdueItems && settings.showOverdueDetails ? [
          {
            type: 'separator',
            margin: 'sm',
            color: COLORS.negative,
          },
          ...metrics.overdueItems.slice(0, 3).map((item, idx) => ({
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '20px',
                height: '20px',
                backgroundColor: COLORS.negative,
                cornerRadius: '10px',
                contents: [{
                  type: 'text',
                  text: '!',
                  color: COLORS.background,
                  size: 'xs',
                  weight: 'bold',
                  align: 'center',
                }],
              },
              {
                type: 'text',
                text: truncateText(item.title, 20),
                color: COLORS.secondary,
                size: 'xs',
                flex: 1,
              },
              {
                type: 'text',
                text: formatAmount(item.amount),
                color: COLORS.negative,
                size: 'xs',
                weight: 'bold',
                align: 'end',
              },
            ],
          })),
        ] : []),
        ...(metrics.overdueCount > 3 ? [{
          type: 'text',
          text: '+ อีก ' + (metrics.overdueCount - 3) + ' รายการ',
          color: COLORS.negative,
          size: 'xs',
          align: 'center',
          margin: 'sm',
        }] : []),
        ...(!hasOverdueItems ? [{
          type: 'separator',
          margin: 'sm',
          color: COLORS.negative,
        }, {
          type: 'text',
          text: '✅ ไม่มีรายการเกินกำหนด',
          color: COLORS.positiveDark,
          size: 'xs',
          align: 'center',
          margin: 'sm',
        }] : []),
      ],
    });
  }
  
  // ========================================
  // 8. ⚠️ รอชำระ (Pending - LAST per requirement)
  // ========================================
  if (settings.showPending) {
    const hasPendingItems = metrics.pendingCount > 0 && metrics.pendingItems.length > 0;
    
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.pendingBg,
      cornerRadius: '8px',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: '⚠️ รอชำระ',
          color: COLORS.pending,
          weight: 'bold',
          size: 'sm',
        },
        {
          type: 'text',
          text: metrics.pendingCount + ' รายการ',
          color: COLORS.pending,
          size: 'xs',
          margin: 'sm',
        },
        {
          type: 'text',
          text: formatAmount(metrics.pendingTotal),
          color: COLORS.pending,
          size: 'sm',
          weight: 'bold',
          margin: 'sm',
        },
        ...(hasPendingItems && settings.showPendingDetails ? [
          {
            type: 'separator',
            margin: 'sm',
            color: COLORS.pending,
          },
          ...metrics.pendingItems.slice(0, 3).map((item, idx) => ({
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '20px',
                height: '20px',
                backgroundColor: COLORS.pending,
                cornerRadius: '10px',
                contents: [{
                  type: 'text',
                  text: String(idx + 1),
                  color: COLORS.background,
                  size: 'xs',
                  weight: 'bold',
                  align: 'center',
                }],
              },
              {
                type: 'text',
                text: truncateText(item.title, 20),
                color: COLORS.secondary,
                size: 'xs',
                flex: 1,
              },
              {
                type: 'text',
                text: formatAmount(item.amount),
                color: COLORS.pending,
                size: 'xs',
                weight: 'bold',
                align: 'end',
              },
            ],
          })),
        ] : []),
        ...(metrics.pendingCount > 3 ? [{
          type: 'text',
          text: '+ อีก ' + (metrics.pendingCount - 3) + ' รายการ',
          color: COLORS.pending,
          size: 'xs',
          align: 'center',
          margin: 'sm',
        }] : []),
        ...(!hasPendingItems ? [{
          type: 'separator',
          margin: 'sm',
          color: COLORS.pending,
        }, {
          type: 'text',
          text: '✅ ไม่มีรายการรอชำระ',
          color: COLORS.positiveDark,
          size: 'xs',
          align: 'center',
          margin: 'sm',
        }] : []),
      ],
    });
  }
  
  // ========================================
  // Single Bubble (light theme)
  // ========================================
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.background,
      paddingAll: '16px',
      spacing: 'md',
      contents: bodyContents,
    },
  };
}

// ============================================================
// SAMPLE DATA FOR TESTING
// ============================================================

export const SAMPLE_METRICS: LineNotificationMetrics = {
  totalBalance: 1250000,
  monthlyIncome: 350000,
  monthlyExpense: 285000,
  monthlyNet: 65000,
  pendingCount: 5,
  pendingTotal: 85000,
  overdueCount: 2,
  overdueTotal: 25000,
  pendingItems: [
    { title: 'ค่าบริการลูกค้า A', amount: 45000 },
    { title: 'ค่าออกแบบโลโก้บริษัท', amount: 25000 },
    { title: 'ค่าปรึกษาธุรกิจ', amount: 15000 },
    { title: 'ค่าจัดงานอีเวนต์', amount: 8000 },
    { title: 'ค่าโฆษณาออนไลน์', amount: 5000 },
  ],
  overdueItems: [
    { title: 'ค่าเช่าพื้นที่ธันวาคม', amount: 18000 },
    { title: 'ค่าซอฟต์แวร์รายปี', amount: 7000 },
  ],
};

export const SAMPLE_SETTINGS: DailySummarySettings = {
  sendTime: '08:00',
  showBalance: true,
  showIncome: true,
  showExpense: true,
  showPending: true,
  showOverdue: true,
  showPendingDetails: true,
  showOverdueDetails: true,
};

// ============================================================
// EXPORT FLEX MESSAGE JSON
// ============================================================

export function getSampleFlexMessage(): any {
  return buildDailySummaryFlexMessage(SAMPLE_METRICS, SAMPLE_SETTINGS);
}
