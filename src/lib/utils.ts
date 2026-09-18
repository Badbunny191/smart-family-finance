import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Central account display formatter.
 * Used consistently across all pages to show account names.
 *
 * Format:
 * - Bank + name:     "🏦 {name} ({bankName})\n{last4}"
 * - Bank + no name:  "🏦 {bankName}\n{last4}"
 * - Cash + name:     "💵 {name} (เงินสด)"
 * - Cash + no name:  "💵 เงินสด"
 *
 * last4 = accountNumber.replace(/-/g, '').slice(-4)
 * (removes dashes before slicing to avoid "22-5" from "322-5")
 */
export type AccountDisplayInput = {
  accountType: 'bank' | 'cash';

  /** Display name (primary) */
  name?: string | null;

  accountAlias?: string | null;

  bankName?: string | null;
  accountNumber?: string | null;
};

export function formatAccountDisplayName(account: AccountDisplayInput): string {
  const { accountType, name, bankName, accountNumber } = account;

  if (accountType === 'cash') {
    return name ? `💵 ${name} (เงินสด)` : '💵 เงินสด';
  }

  // Bank account
  const last4 =
    accountNumber && accountNumber.length > 0
      ? accountNumber.replace(/-/g, '').slice(-4)
      : '';

  const bank = bankName || 'ไม่ระบุธนาคาร';
  const prefix = '🏦';

  if (name) {
    return last4
      ? `${prefix} ${name} (${bank})\n${last4}`
      : `${prefix} ${name} (${bank})`;
  }

  // No name → show only bank + last4
  return last4 ? `${prefix} ${bank}\n${last4}` : `${prefix} ${bank}`;
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