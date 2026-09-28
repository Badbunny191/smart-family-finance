/**
 * LINE Flex Message Builder - DESIGN MASTER
 * 
 * UI Approved: NO CHANGES ALLOWED
 * 
 * This file matches the Design Master JSON exactly.
 * Only dynamic values change - structure is LOCKED.
 */

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface TransactionItem {
  title: string;
  amount: number;
}

export interface TodaySummary {
  receivedCount: number;
  receivedAmount: number;
  paidCount: number;
  paidAmount: number;
}

export interface MonthlySummary {
  income: number;
  expense: number;
}

export interface LineFlexMetrics {
  totalBalance: number;
  monthly: MonthlySummary;
  today: TodaySummary;
  overdueReceive: TransactionItem[];
  overduePay: TransactionItem[];
  pendingReceive: TransactionItem[];
  pendingPay: TransactionItem[];
}

export interface LineFlexSettings {
  sendTime: string;
  showBalance: boolean;
  showMonthly: boolean;
  showToday: boolean;
  showOverdueReceive: boolean;
  showOverduePay: boolean;
  showPendingReceive: boolean;
  showPendingPay: boolean;
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Format number to Thai currency
 */
export function formatCurrency(amount: number): string {
  return '฿ ' + amount.toLocaleString('th-TH');
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateName(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================================
// DATE/TIME HELPERS
// ============================================================

export interface DateTimeHeader {
  date: string;      // "28/09/2569"
  time: string;      // "08:00"
}

export function getBangkokDateTime(): DateTimeHeader {
  const now = new Date();
  
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const dateStr = dateFormatter.format(now);
  const timeStr = timeFormatter.format(now);
  
  // Convert to Buddhist Era
  const dateParts = dateStr.split('/');
  if (dateParts.length === 3) {
    const ceYear = parseInt(dateParts[2], 10);
    if (!isNaN(ceYear)) {
      dateParts[2] = String(ceYear + 543);
    }
  }
  
  return {
    date: dateParts.join('/'),
    time: timeStr,
  };
}

// ============================================================
// FLEX MESSAGE BUILDER - DESIGN MASTER
// ============================================================

/**
 * Build LINE Flex Message matching Design Master JSON exactly
 * NO CHANGES to structure - only dynamic values
 */
export function buildFlexMessage(
  metrics: LineFlexMetrics,
  settings: LineFlexSettings = {
    sendTime: '08:00',
    showBalance: true,
    showMonthly: true,
    showToday: true,
    showOverdueReceive: true,
    showOverduePay: true,
    showPendingReceive: true,
    showPendingPay: true,
  }
): any {
  const { date, time } = getBangkokDateTime();
  const net = metrics.monthly.income - metrics.monthly.expense;
  const netColor = net >= 0 ? '#059669' : '#DC2626';
  const contents: any[] = [];
  
  // ========================================
  // 1. วันที่ / เวลา (LOCKED)
  // ========================================
  contents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `📅 วันที่ ${date}`,
        size: 'xs',
        color: '#475569',
      },
      {
        type: 'text',
        text: `🕒 เวลา ${time} น.`,
        size: 'xs',
        color: '#475569',
        align: 'end',
      },
    ],
  });
  
  // ========================================
  // 2. คงเหลือรวม (LOCKED)
  // ========================================
  if (settings.showBalance) {
    contents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#ECFDF5',
      cornerRadius: '12px',
      paddingAll: '14px',
      alignItems: 'center',
      contents: [
        {
          type: 'text',
          text: '💰 คงเหลือรวม',
          size: 'xs',
          color: '#065F46',
          weight: 'bold',
        },
        {
          type: 'text',
          text: formatCurrency(metrics.totalBalance),
          size: 'xl',
          weight: 'bold',
          color: '#047857',
          margin: 'xs',
        },
      ],
    });
  }
  
  // ========================================
  // 3. รายรับ/รายจ่าย/สุทธิ (LOCKED)
  // ========================================
  if (settings.showMonthly) {
    contents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        // รายรับ
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            {
              type: 'text',
              text: '📈 รายรับเดือนนี้',
              size: 'sm',
              color: '#059669',
              flex: 2,
            },
            {
              type: 'text',
              text: formatCurrency(metrics.monthly.income),
              size: 'sm',
              weight: 'bold',
              color: '#059669',
              align: 'end',
              flex: 2,
            },
          ],
        },
        // รายจ่าย
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            {
              type: 'text',
              text: '📉 รายจ่ายเดือนนี้',
              size: 'sm',
              color: '#DC2626',
              flex: 2,
            },
            {
              type: 'text',
              text: formatCurrency(metrics.monthly.expense),
              size: 'sm',
              weight: 'bold',
              color: '#DC2626',
              align: 'end',
              flex: 2,
            },
          ],
        },
        // สุทธิ
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            {
              type: 'text',
              text: '✅ สุทธิ',
              size: 'sm',
              weight: 'bold',
              color: netColor,
              flex: 2,
            },
            {
              type: 'text',
              text: (net >= 0 ? '+' : '') + formatCurrency(net),
              size: 'sm',
              weight: 'bold',
              color: netColor,
              align: 'end',
              flex: 2,
            },
          ],
        },
      ],
    });
  }
  
  // ========================================
  // 4. รายการวันนี้ (LOCKED) - แสดงเสมอ
  // ========================================
  if (settings.showToday) {
    const hasTodayData = metrics.today.receivedCount > 0 || metrics.today.paidCount > 0;
    
    contents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        {
          type: 'text',
          text: '📅 รายการวันนี้',
          size: 'xs',
          weight: 'bold',
          color: '#334155',
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: hasTodayData ? [
            // รับวันนี้
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#ECFDF5',
              paddingAll: '10px',
              cornerRadius: '8px',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: `รับวันนี้ ${metrics.today.receivedCount} รายการ`,
                  size: 'xxs',
                  color: '#065F46',
                },
                {
                  type: 'text',
                  text: formatCurrency(metrics.today.receivedAmount),
                  size: 'md',
                  weight: 'bold',
                  color: '#047857',
                  margin: 'xs',
                },
              ],
            },
            // จ่ายวันนี้
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#FEF2F2',
              paddingAll: '10px',
              cornerRadius: '8px',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: `จ่ายวันนี้ ${metrics.today.paidCount} รายการ`,
                  size: 'xxs',
                  color: '#991B1B',
                },
                {
                  type: 'text',
                  text: formatCurrency(metrics.today.paidAmount),
                  size: 'md',
                  weight: 'bold',
                  color: '#B91C1C',
                  margin: 'xs',
                },
              ],
            },
          ] : [
            {
              type: 'box',
              layout: 'vertical',
              paddingAll: '10px',
              cornerRadius: '8px',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: 'ไม่มีรายการ',
                  size: 'xxs',
                  color: '#94A3B8',
                  align: 'center',
                },
              ],
            },
          ],
        },
      ],
    });
  }
  
  // ========================================
  // 5. เกินกำหนดรับ (LOCKED) - แสดงเสมอ
  // ========================================
  if (settings.showOverdueReceive) {
    const totalAmount = metrics.overdueReceive.reduce((sum, item) => sum + item.amount, 0);
    
    contents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#FFFBEB',
      cornerRadius: '8px',
      paddingAll: '12px',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            {
              type: 'text',
              text: `⏰ เกินกำหนดรับ`,
              size: 'xs',
              weight: 'bold',
              color: '#D97706',
              flex: 2,
            },
            {
              type: 'text',
              text: formatCurrency(totalAmount),
              size: 'xs',
              weight: 'bold',
              color: '#B45309',
              align: 'end',
              flex: 1,
            },
          ],
        },
        {
          type: 'text',
          text: `${metrics.overdueReceive.length} รายการ`,
          size: 'xxs',
          color: '#92400E',
        },
        {
          type: 'text',
          text: metrics.overdueReceive.length > 0
            ? metrics.overdueReceive
                .slice(0, 3)
                .map(item => `• ${truncateName(item.title)} (${formatCurrency(item.amount)})`)
                .join('\n') +
              (metrics.overdueReceive.length > 3 ? `\n+ อีก ${metrics.overdueReceive.length - 3} รายการ` : '')
            : 'ไม่มีรายการ',
          size: 'xxs',
          color: metrics.overdueReceive.length > 0 ? '#92400E' : '#94A3B8',
          wrap: true,
        },
      ],
    });
  }
  
  // ========================================
  // 6. เกินกำหนดจ่าย (LOCKED) - แสดงเสมอ
  // ========================================
  if (settings.showOverduePay) {
    const totalAmount = metrics.overduePay.reduce((sum, item) => sum + item.amount, 0);
    
    contents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#FEF2F2',
      cornerRadius: '8px',
      paddingAll: '12px',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            {
              type: 'text',
              text: `🚨 เกินกำหนดจ่าย`,
              size: 'xs',
              weight: 'bold',
              color: '#DC2626',
              flex: 2,
            },
            {
              type: 'text',
              text: formatCurrency(totalAmount),
              size: 'xs',
              weight: 'bold',
              color: '#DC2626',
              align: 'end',
              flex: 1,
            },
          ],
        },
        {
          type: 'text',
          text: `${metrics.overduePay.length} รายการ`,
          size: 'xxs',
          color: '#991B1B',
        },
        {
          type: 'text',
          text: metrics.overduePay.length > 0
            ? metrics.overduePay
                .slice(0, 3)
                .map(item => `• ${truncateName(item.title)} (${formatCurrency(item.amount)})`)
                .join('\n') +
              (metrics.overduePay.length > 3 ? `\n+ อีก ${metrics.overduePay.length - 3} รายการ` : '')
            : 'ไม่มีรายการ',
          size: 'xxs',
          color: metrics.overduePay.length > 0 ? '#991B1B' : '#94A3B8',
          wrap: true,
        },
      ],
    });
  }
  
  // ========================================
  // 7. รายการรอดำเนินการ (LOCKED) - แสดงเสมอ
  // ========================================
  if (settings.showPendingReceive || settings.showPendingPay) {
    const pendingContents: any[] = [
      {
        type: 'text',
        text: '🟡 รายการรอดำเนินการ',
        size: 'xs',
        weight: 'bold',
        color: '#334155',
      },
    ];
    
    const pendingSections: any[] = [];
    
    // รอรับเงิน
    if (settings.showPendingReceive) {
      const totalReceive = metrics.pendingReceive.reduce((sum, item) => sum + item.amount, 0);
      pendingSections.push(
        {
          type: 'box',
          layout: 'baseline',
          margin: 'xs',
          contents: [
            {
              type: 'text',
              text: `💰 รอรับเงิน`,
              size: 'xs',
              weight: 'bold',
              color: '#059669',
              flex: 2,
            },
            {
              type: 'text',
              text: formatCurrency(totalReceive),
              size: 'xs',
              weight: 'bold',
              color: '#059669',
              align: 'end',
              flex: 1,
            },
          ],
        },
        {
          type: 'text',
          text: `${metrics.pendingReceive.length} รายการ`,
          size: 'xxs',
          color: '#047857',
          margin: 'xs',
        },
        {
          type: 'text',
          text: metrics.pendingReceive.length > 0
            ? metrics.pendingReceive
                .slice(0, 3)
                .map(item => `• ${truncateName(item.title)} (${formatCurrency(item.amount)})`)
                .join('\n') +
              (metrics.pendingReceive.length > 3 ? `\n+ อีก ${metrics.pendingReceive.length - 3} รายการ` : '')
            : 'ไม่มีรายการ',
          size: 'xxs',
          color: metrics.pendingReceive.length > 0 ? '#047857' : '#94A3B8',
          wrap: true,
        }
      );
    }
    
    // Separator (ระหว่างรอรับ/รอจ่าย — แสดงเมื่อมีทั้งคู่)
    if (settings.showPendingReceive && settings.showPendingPay) {
      pendingSections.push({
        type: 'separator',
        color: '#E2E8F0',
        margin: 'xs',
      });
    }
    
    // รอจ่าย
    if (settings.showPendingPay) {
      const totalPay = metrics.pendingPay.reduce((sum, item) => sum + item.amount, 0);
      pendingSections.push(
        {
          type: 'box',
          layout: 'baseline',
          margin: 'xs',
          contents: [
            {
              type: 'text',
              text: `💸 รอจ่าย`,
              size: 'xs',
              weight: 'bold',
              color: '#B45309',
              flex: 2,
            },
            {
              type: 'text',
              text: formatCurrency(totalPay),
              size: 'xs',
              weight: 'bold',
              color: '#B45309',
              align: 'end',
              flex: 1,
            },
          ],
        },
        {
          type: 'text',
          text: `${metrics.pendingPay.length} รายการ`,
          size: 'xxs',
          color: '#92400E',
          margin: 'xs',
        },
        {
          type: 'text',
          text: metrics.pendingPay.length > 0
            ? metrics.pendingPay
                .slice(0, 3)
                .map(item => `• ${truncateName(item.title)} (${formatCurrency(item.amount)})`)
                .join('\n') +
              (metrics.pendingPay.length > 3 ? `\n+ อีก ${metrics.pendingPay.length - 3} รายการ` : '')
            : 'ไม่มีรายการ',
          size: 'xxs',
          color: metrics.pendingPay.length > 0 ? '#92400E' : '#94A3B8',
          wrap: true,
        }
      );
    }
    
    pendingContents.push(...pendingSections);
    
    contents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F8FAFC',
      cornerRadius: '8px',
      paddingAll: '12px',
      spacing: 'xs',
      contents: pendingContents,
    });
  }
  
  // ========================================
  // FINAL FLEX MESSAGE (LOCKED)
  // ========================================
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'md',
      contents,
    },
  };
}
