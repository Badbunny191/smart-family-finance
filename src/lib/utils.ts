import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard account display (used in transaction cards, dashboard transactions).
 * Falls back to `owner` when `name` is empty.
 *
 * Format:
 * - Bank + name:     "{name}\n({bankName}) {last4}"
 * - Bank + no name:  "{owner}\n({bankName}) {last4}"  ← fallback to owner
 * - Bank + nothing:  "({bankName}) {last4}"
 * - Cash + name:     "💵 {name}\n(เงินสด)"
 * - Cash + no name:  "💵 {owner}\n(เงินสด)"  ← fallback to owner
 *
 * last4 = accountNumber.replace(/-/g, '').slice(-4)
 */
export type AccountDisplayInput = {
  accountType: 'bank' | 'cash';

  /** Display name (primary) */
  name?: string | null;

  /** Owner/person name — used as fallback when name is empty */
  owner?: string | null;

  accountAlias?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
};

export function formatAccountDisplayName(account: AccountDisplayInput): string {
  const { accountType, name, owner, bankName, accountNumber } = account;

  // Fallback: use owner when name is empty
  const displayName = name?.trim() || owner?.trim() || '';

  if (accountType === 'cash') {
    return displayName ? `💵 ${displayName}\n(เงินสด)` : '💵 เงินสด';
  }

  // Bank account
  const last4 =
    accountNumber && accountNumber.length > 0
      ? accountNumber.replace(/-/g, '').slice(-4)
      : '';

  const bank = bankName || 'ไม่ระบุธนาคาร';

  if (displayName) {
    return last4 ? `${displayName}\n(${bank}) ${last4}` : `${displayName}\n(${bank})`;
  }

  // No name, no owner → show only bank + last4
  return last4 ? `(${bank}) ${last4}` : `(${bank})`;
}

/**
 * Account display for /accounts page (includes owner).
 * Falls back to `owner` when `name` is empty.
 */
export function formatAccountForAccountsPage(
  account: AccountDisplayInput & { owner?: string | null },
): string {
  const { accountType, name, owner, bankName, accountNumber } = account;

  // Fallback: use owner when name is empty
  const displayName = name?.trim() || owner?.trim() || '';

  const last4 =
    accountNumber && accountNumber.length > 0
      ? accountNumber.replace(/-/g, '').slice(-4)
      : '';

  if (accountType === 'cash') {
    const base = displayName ? `💵 ${displayName}\n(เงินสด)` : '💵 เงินสด';
    return owner ? `${base}\nเจ้าของ : ${owner}` : base;
  }

  const bank = bankName || 'ไม่ระบุธนาคาร';
  const base = last4
    ? `${displayName}\n(${bank}) ${last4}`
    : `${displayName}\n(${bank})`;
  return owner ? `${base.trim()}\nเจ้าของ : ${owner}` : base.trim();
}

/**
 * Account display for form selectors (dropdowns).
 * Falls back to `owner` when `name` is empty.
 */
export function formatAccountForSelector(account: AccountDisplayInput): string {
  const { accountType, name, owner, bankName, accountNumber } = account;

  // Fallback: use owner when name is empty
  const displayName = name?.trim() || owner?.trim() || '';

  if (accountType === 'cash') {
    return displayName ? `💵 ${displayName} (เงินสด)` : '💵 เงินสด';
  }

  const last4 =
    accountNumber && accountNumber.length > 0
      ? accountNumber.replace(/-/g, '').slice(-4)
      : '';
  const bank = bankName || 'ไม่ระบุธนาคาร';

  if (displayName) {
    return last4 ? `🏦 ${displayName} (${bank}) - ${last4}` : `🏦 ${displayName} (${bank})`;
  }
  return last4 ? `🏦 ${bank} - ${last4}` : `🏦 ${bank}`;
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount);
}

// Buddhist Calendar date formatter (พ.ศ. ทุกครั้ง)
function createBuddhistFormatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('th-TH', { calendar: 'buddhist', ...options });
}

/**
 * Format date as short format: 20 ก.ย. 2569
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return createBuddhistFormatter({ day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Format date as full format: วันอาทิตย์ที่ 20 กันยายน พ.ศ. 2569
 */
export function formatDateFull(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return createBuddhistFormatter({
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Format date range: 1 ก.ย. 2569 - 20 ก.ย. 2569
 * Returns single date if same day
 */
export function formatDateRange(start: Date | string, end: Date | string): string {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;

  if (s.toDateString() === e.toDateString()) {
    return formatDate(s);
  }

  return `${formatDate(s)} - ${formatDate(e)}`;
}
