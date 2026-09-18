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
