/**
 * Financial Report Generator
 *
 * Generates a shareable financial report (daily/weekly/monthly) for LINE sharing
 */

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

export type TransactionRow = {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  date: string; // ISO string
  title: string;
  propertyId: string | null;
  propertyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
};

export type Property = { id: string; name: string };

export type ReportItem = {
  date: string; // formatted Thai date "02 ส.ค. 2569"
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
      // getDay(): Sun=0, Mon=1, Tue=2, ..., Sat=6
      // To shift to Monday start: treat Sun(0) as 7
      const dayOfWeek = start.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - daysSinceMonday);

      // End of week = Sunday end-of-day
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
        // Fallback to month if no range set
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
 * Build report from transactions
 */
export function buildReport(
  transactions: TransactionRow[],
  period: ReportPeriod,
  reference: Date = new Date(),
  customRange?: { start: string; end: string }
): Report {
  const { start, end, label } = getPeriodRange(period, reference, customRange);

  // Filter only completed income/expense in date range
  const filtered = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return (
      txDate >= start &&
      txDate <= end &&
      (tx.type === 'income' || tx.type === 'expense')
    );
  });

  // Separate income / expense
  const incomeTxs = filtered.filter((tx) => tx.type === 'income');
  const expenseTxs = filtered.filter((tx) => tx.type === 'expense');

  // Build items
  const incomeItems: ReportItem[] = incomeTxs
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((tx) => ({
      date: formatThaiDate(new Date(tx.date), 'short'),
      title: tx.title,
      icon: tx.categoryIcon || '📥',
      amount: tx.amount,
    }));

  const expenseItems: ReportItem[] = expenseTxs
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((tx) => ({
      date: formatThaiDate(new Date(tx.date), 'short'),
      title: tx.title,
      icon: tx.categoryIcon || '💸',
      amount: tx.amount,
    }));

  // Group expense by property
  const propertyGroupsMap = new Map<string, PropertyGroup>();

  for (const tx of expenseTxs) {
    const propId = tx.propertyId || '__unassigned__';
    const propName = tx.propertyName || 'ทั่วไป';

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
      date: formatThaiDate(new Date(tx.date), 'short'),
      title: tx.title,
      icon: tx.categoryIcon || '💸',
      amount: tx.amount,
    });
  }

  // Sort property groups by total DESC
  const byProperty = Array.from(propertyGroupsMap.values()).sort(
    (a, b) => b.total - a.total
  );
  // Sort items within each group by date ASC
  byProperty.forEach((g) => {
    g.items.sort((a, b) => a.date.localeCompare(b.date));
  });

  return {
    period,
    periodLabel: label,
    startDate: start,
    endDate: end,
    income: {
      total: incomeTxs.reduce((sum, tx) => sum + tx.amount, 0),
      items: incomeItems,
    },
    expense: {
      total: expenseTxs.reduce((sum, tx) => sum + tx.amount, 0),
      items: expenseItems,
      byProperty,
    },
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
 * Format currency
 */
export function formatCurrencyShort(amount: number): string {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
