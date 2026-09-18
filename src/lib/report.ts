/**
 * Financial Report Generator
 *
 * Generates a shareable financial report (daily/weekly/monthly) for LINE sharing
 *
 * IMPORTANT: Only transactions with status === 'completed' affect real money balance.
 * Pending and cancelled transactions are excluded (consistent with financial engine rules).
 */

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

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
  date: string; // ISO string
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
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let label = '';
  let endOfWeek: Date | null = null;

  switch (period) {
    case 'today': {
      label = `วันนี้ ${formatThaiDate(now, 'long')}`;
      break;
    }
    case 'week': {
      // Start of week = Monday (ISO week standard, also Thai convention)
      const dayOfWeek = start.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - daysSinceMonday);

      endOfWeek = new Date(start);
      endOfWeek.setDate(start.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      label = `สัปดาห์นี้ ${formatThaiDate(start)} - ${formatThaiDate(endOfWeek)}`;
      break;
    }
    case 'month': {
      start.setDate(1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      label = `เดือน${getThaiMonthName(now.getMonth())} ${now.getFullYear() + 543}`;
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

  // Filter: completed income/expense in date range
  const filtered = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return (
      txDate >= start &&
      txDate <= end &&
      (tx.type === 'income' || tx.type === 'expense') &&
      tx.status === 'completed'
    );
  });

  // Separate income / expense
  const incomeTxs = filtered.filter((tx) => tx.type === 'income');
  const expenseTxs = filtered.filter((tx) => tx.type === 'expense');

  // Build items - sort by Date object (epoch ms), not by formatted string
  const incomeItems: ReportItem[] = incomeTxs
    .map((tx) => ({
      dateMs: new Date(tx.date).getTime(),
      dateDisplay: formatThaiDate(new Date(tx.date), 'short'),
      title: tx.title,
      icon: resolveIcon(tx.categoryIcon, '📥'),
      amount: tx.amount,
    }))
    .sort((a, b) => a.dateMs - b.dateMs);

  const expenseItems: ReportItem[] = expenseTxs
    .map((tx) => ({
      dateMs: new Date(tx.date).getTime(),
      dateDisplay: formatThaiDate(new Date(tx.date), 'short'),
      title: tx.title,
      icon: resolveIcon(tx.categoryIcon, '💸'),
      amount: tx.amount,
    }))
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
    group.items.push({
      dateMs: new Date(tx.date).getTime(),
      dateDisplay: formatThaiDate(new Date(tx.date), 'short'),
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

  return {
    period,
    periodLabel: label,
    startDate: start,
    endDate: end,
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
