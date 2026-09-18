import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Central account display formatter.
 * Used consistently across all pages to show account names.
 *
 * Rules:
 * - Cash + alias: "{alias} เงินสด"
 * - Cash + no alias: "เงินสด"
 * - Bank + alias: "{alias} {bankName} • {last4digits}"
 * - Bank + no alias: "{bankName} • {last4digits}"
 *
 * last4digits = accountNumber.replace(/-/g, '').slice(-4)
 * (removes dashes before slicing to avoid "22-5" from "322-5")
 */
export type AccountDisplayInput = {
  accountType: 'bank' | 'cash';

  /** Display name (primary) */
  name: string | null;

  accountAlias?: string | null;

  bankName?: string | null;
  accountNumber?: string | null;
};

export function formatAccountDisplayName(account: AccountDisplayInput): string {
  const { accountType, name, bankName, accountNumber } = account;

  if (accountType === 'cash') {
    return name || 'เงินสด';
  }

  // Bank account
  const last4 =
    accountNumber && accountNumber.length > 0
      ? accountNumber.replace(/-/g, '').slice(-4)
      : '';

  if (name) {
    return last4 ? `${name} • ${last4}` : name;
  }

  // No name → show only bank + last4
  const bank = bankName || 'ไม่ระบุธนาคาร';
  return last4 ? `${bank} • ${last4}` : bank;
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