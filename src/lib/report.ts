/**
 * Financial Report Generator
 *
 * Generates a shareable financial report (daily/weekly/monthly) for LINE sharing
 *
 * IMPORTANT: Only transactions with status === 'completed' affect real money balance.
 * Pending and cancelled transactions are excluded (consistent with financial engine rules).
 *
 * Phase 3: Effective Date is used for date filtering, sorting, and display
 *   - pending               → date
 *   - completed income      → receivedDate ?? date
 *   - completed expense     → paidDate ?? date
 *   - transfer / adjustment → date
 *
 * Aligned with Transactions / Dashboard / LINE Summary.
 * See: src/lib/utils.ts → getEffectiveDate() (JS helper, single source of truth)
 */

import { getEffectiveDate } from './utils';

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

import { getCurrentMonthRange, getTodayRange, getWeekRange } from './line-cron-service';

/**
 * Central resolver for category icon rendering in LINE Report.
 *
 * The categories table stores icon as a Lucide icon name (e.g. "Banknote").
 * The LINE Report renderer cannot render Lucide SVGs reliably across devices,
 * so we map each Lucide name to a universal emoji before rendering.
 *
 * Keep this map in sync with CATEGORY_ICONS in src/components/category-icon.tsx.
 *
 * Behavior:
 * - null/empty  -> fallback (📥 income / 💸 expense)
 * - Lucide name -> mapped emoji
 * - Already emoji (legacy data before icon migration) -> pass-through
 * - Unknown     -> fallback
 */
const ICON_NAME_TO_EMOJI: Record<string, string> = {
  // Finance
  Banknote: '💰',
  Wallet: '👛',
  CreditCard: '💳',
  PiggyBank: '🐷',
  Landmark: '🏦',
  // Property
  House: '🏠',
  Building2: '🏢',
  Key: '🔑',
  // Utilities
  Wifi: '📶',
  Zap: '⚡',
  Droplets: '💧',
  Wrench: '🔧',
  // Lifestyle
  ShoppingCart: '🛒',
  UtensilsCrossed: '🍴',
  Car: '🚗',
  Fuel: '⛽',
  // General
  Package: '📦',
  ReceiptText: '🧾',
  Briefcase: '💼',
  CirclePlus: '➕',
};

/**
 * Quick heuristic: emoji characters usually have codepoint > U+2000
 * on the first character. Lucide icon names are ASCII letters (A-Z).
 */
function isLikelyEmoji(s: string): boolean {
  if (!s) return false;
  const code = s.codePointAt(0) ?? 0;
  // ASCII letters/digits (Lucide names) are <= 0x7A
  return code > 0x2000;
}

/**
 * Resolve a raw categoryIcon value (from DB) into a renderable emoji.
 * - null/undefined -> fallback
 * - Lucide name    -> mapped emoji
 * - Already emoji  -> pass-through (legacy data)
 * - Unknown        -> fallback
 */
export function resolveIcon(
  rawIcon: string | null | undefined,
  fallback: string
): string {
  if (!rawIcon) return fallback;
  if (isLikelyEmoji(rawIcon)) return rawIcon;
  return ICON_NAME_TO_EMOJI[rawIcon] ?? fallback;
}

export type TransactionRow = {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  /** ISO string OR unix-seconds-as-string (API returns seconds; we keep as string for getEffectiveDate()). */
  date: string;
  /** ISO string OR unix-seconds-as-string (income, completed). Null otherwise. */
  receivedDate: string | null;
  /** ISO string OR unix-seconds-as-string (expense, completed). Null otherwise. */
  paidDate: string | null;
  /** Phase 3: drives effective-date rule in getEffectiveDate() */
  businessStatus: 'pending' | 'received' | null;
  title: string;
  status?: 'pending' | 'completed' | 'cancelled' | null;
  propertyId: string | null;
  propertyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
};

export type Property = { id: string; name: string };

export type ReportItem = {
  /** epoch ms - for reliable date sorting */
  dateMs: number;
  /** formatted Thai date "02 ส.ค. 2569" - for display */
  dateDisplay: string;
  title: string;
  icon: string;
  amount: number;
};

export type PropertyGroup = {
  propertyId: string;
  propertyName: string;
  total: number;
  items: ReportItem[];
};

export type Report = {
  period: ReportPeriod;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  income: {
    total: number;
    items: ReportItem[];
  };
  expense: {
    total: number;
    items: ReportItem[];
    byProperty: PropertyGroup[];
  };
  /** Net = income.total - expense.total */
  net: number;
};

/**
 * Get date range for a given period
 *
 * IMPORTANT: For 'month' period, this uses Bangkok timezone boundary
 * (same as Dashboard/Auto Send) to ensure consistent results.
 * Uses Intl.DateTimeFormat to avoid browser local timezone issues.
 */
export function getPeriodRange(
  period: ReportPeriod,
  reference: Date = new Date(),
  customRange?: { start: string; end: string }
): {
  start: Date;
  end: Date;
  label: string;
} {
  const now = new Date(reference);

  // Declare as `let` so week case can reassign after Intl parsing
  let start: Date;
  let end: Date;
  let label = '';
  let endOfWeek: Date | null = null;

  // For 'month' period: use Bangkok timezone boundary (same as Dashboard)
  // to avoid browser local timezone issues
  if (period === 'month') {
    const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const bangkokDateStr = bangkokFormatter.format(now);
    const [year, month] = bangkokDateStr.split('-').map(Number);

    // Bangkok first of month at 00:00:00
    start = new Date(Date.UTC(year, month - 1, 1));
    // Bangkok last day of month (day = 0 in next month = last day of current)
    end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    label = `เดือน${getThaiMonthName(month - 1)} ${year + 543}`;
    return { start, end, label };
  }

  // For 'today' and 'week': use Bangkok timezone
  const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const bangkokDateStr = bangkokFormatter.format(now);
  const [year, month, day] = bangkokDateStr.split('-').map(Number);

  // Bangkok today at midnight
  start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  switch (period) {
    case 'today': {
      label = `วันนี้ ${formatThaiDate(new Date(start), 'long')}`;
      break;
    }
    case 'week': {
      // Use getWeekRange for consistent week boundary (unix seconds + label)
      const { weekStart, weekEnd } = getWeekRange();
      start = new Date((weekStart + 7 * 60 * 60) * 1000);
      end = new Date((weekEnd + 7 * 60 * 60) * 1000);
      label = `สัปดาห์นี้ ${formatThaiDate(start)} - ${formatThaiDate(end)}`;
      endOfWeek = end;
      break;
    }
    case 'custom': {
      if (!customRange?.start || !customRange?.end) {
        start.setDate(1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        label = 'กำหนดช่วงเอง';
        return { start, end: endOfMonth, label };
      }
      const [sy, sm, sd] = customRange.start.split('-').map(Number);
      const [ey, em, ed] = customRange.end.split('-').map(Number);
      start.setFullYear(sy, sm - 1, sd);
      start.setHours(0, 0, 0, 0);
      endOfWeek = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      label = `${formatThaiDate(start)} - ${formatThaiDate(endOfWeek)}`;
      break;
    }
  }

  return { start, end: endOfWeek ?? end, label };
}

/**
 * Build report from transactions.
 *
 * Business Rule (aligned with financial engine):
 * - Only `status === 'completed'` transactions are included.
 * - `pending` and `cancelled` are excluded (they don't affect real balance).
 */
export function buildReport(
  transactions: TransactionRow[],
  period: ReportPeriod,
  reference: Date = new Date(),
  customRange?: { start: string; end: string }
): Report {
  const { start, end, label } = getPeriodRange(period, reference, customRange);

  // For 'month' period: use Bangkok month boundary from line-cron-service
  // (same as Dashboard and Flex) to ensure consistent results
  const monthRange = period === 'month' ? getCurrentMonthRange() : null;
  // For 'week' period: use Bangkok week boundary in unix seconds
  const weekRange = period === 'week' ? getWeekRange() : null;
  // For 'today' period: use Bangkok today range in unix seconds
  const todayRange = period === 'today' ? getTodayRange() : null;

  // Filter: completed income/expense in date range
  // Phase 3: use getEffectiveDate() — same rule as Transactions / Dashboard / LINE
  //   - pending               → date
  //   - completed income      → receivedDate ?? date
  //   - completed expense     → paidDate ?? date
  //   - transfer / adjustment → date
  const filtered = transactions.filter((tx) => {
    // Only completed income/expense affect real balance
    if (tx.status !== 'completed') return false;
    if (tx.type !== 'income' && tx.type !== 'expense') return false;

    const effectiveMs = getEffectiveDate(tx).getTime();

    // For 'month' period: use Bangkok unix seconds comparison (same as Dashboard/Flex)
    if (monthRange) {
      const txDateSec = effectiveMs / 1000;
      return (
        txDateSec >= monthRange.monthStart &&
        txDateSec < monthRange.nextMonthStart
      );
    }

    // For 'week' period: use Bangkok unix seconds comparison
    if (weekRange) {
      const txDateSec = effectiveMs / 1000;
      return (
        txDateSec >= weekRange.weekStart &&
        txDateSec <= weekRange.weekEnd
      );
    }

    // For 'today' period: use Bangkok unix seconds comparison
    if (todayRange) {
      const txDateSec = effectiveMs / 1000;
      return (
        txDateSec >= todayRange.todayStart &&
        txDateSec <= todayRange.todayEnd
      );
    }

    // For 'custom': use Date comparison (legacy, less critical)
    const effectiveDate = new Date(effectiveMs);
    return effectiveDate >= start && effectiveDate <= end;
  });

  // Separate income / expense
  const incomeTxs = filtered.filter((tx) => tx.type === 'income');
  const expenseTxs = filtered.filter((tx) => tx.type === 'expense');

  // Build items - sort by effective date (epoch ms), not by formatted string
  const incomeItems: ReportItem[] = incomeTxs
    .map((tx) => {
      const effectiveDate = getEffectiveDate(tx);
      return {
        dateMs: effectiveDate.getTime(),
        dateDisplay: formatThaiDate(effectiveDate, 'short'),
        title: tx.title,
        icon: resolveIcon(tx.categoryIcon, '📥'),
        amount: tx.amount,
      };
    })
    .sort((a, b) => a.dateMs - b.dateMs);

  const expenseItems: ReportItem[] = expenseTxs
    .map((tx) => {
      const effectiveDate = getEffectiveDate(tx);
      return {
        dateMs: effectiveDate.getTime(),
        dateDisplay: formatThaiDate(effectiveDate, 'short'),
        title: tx.title,
        icon: resolveIcon(tx.categoryIcon, '💸'),
        amount: tx.amount,
      };
    })
    .sort((a, b) => a.dateMs - b.dateMs);

  // Group expense by property
  const propertyGroupsMap = new Map<string, PropertyGroup>();

  for (const tx of expenseTxs) {
    const propId = tx.propertyId || '__unassigned__';
    const propName = tx.propertyName || 'ไม่ได้ผูกทรัพย์สิน';

    if (!propertyGroupsMap.has(propId)) {
      propertyGroupsMap.set(propId, {
        propertyId: propId === '__unassigned__' ? '' : propId,
        propertyName: propName,
        total: 0,
        items: [],
      });
    }

    const group = propertyGroupsMap.get(propId)!;
    group.total += tx.amount;
    const effectiveDate = getEffectiveDate(tx);
    group.items.push({
      dateMs: effectiveDate.getTime(),
      dateDisplay: formatThaiDate(effectiveDate, 'short'),
      title: tx.title,
      icon: resolveIcon(tx.categoryIcon, '💸'),
      amount: tx.amount,
    });
  }

  // Sort property groups by total DESC
  const byProperty = Array.from(propertyGroupsMap.values()).sort(
    (a, b) => b.total - a.total
  );
  // Sort items within each group by epoch ms ASC (correct chronological order)
  byProperty.forEach((g) => {
    g.items.sort((a, b) => a.dateMs - b.dateMs);
  });

  const incomeTotal = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const expenseTotal = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);

  // For 'month' period: use Bangkok month boundary Dates for report display
  // (same as Dashboard and Flex) — this makes startDate/endDate correct in report
  const reportStart = monthRange
    ? new Date(monthRange.monthStart * 1000)
    : start;
  const reportEnd = monthRange
    ? new Date(monthRange.nextMonthStart * 1000 - 1) // inclusive end (one less than next month)
    : end;

  return {
    period,
    periodLabel: label,
    startDate: reportStart,
    endDate: reportEnd,
    income: {
      total: incomeTotal,
      items: incomeItems,
    },
    expense: {
      total: expenseTotal,
      items: expenseItems,
      byProperty,
    },
    net: incomeTotal - expenseTotal,
  };
}

/**
 * Format Thai date
 */
function formatThaiDate(date: Date, format: 'short' | 'long' = 'short'): string {
  const day = date.getDate();
  const month = getThaiMonthShort(date.getMonth());
  const year = date.getFullYear() + 543;
  return `${day.toString().padStart(2, '0')} ${month} ${year}`;
}

/**
 * Get Thai month short name
 */
function getThaiMonthShort(month: number): string {
  const names = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  return names[month];
}

/**
 * Get Thai month full name
 */
function getThaiMonthName(month: number): string {
  const names = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  return names[month];
}

/**
 * Format currency (no fractional digits when .00, preserves meaningful decimals)
 */
export function formatCurrencyShort(amount: number): string {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format currency with 2 fixed decimal places (used for summary totals)
 */
export function formatCurrencyExact(amount: number): string {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
