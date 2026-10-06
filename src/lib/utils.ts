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
// Uses Asia/Bangkok timezone to correctly display dates from database (stored as UTC)
function createBuddhistFormatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('th-TH', { 
    calendar: 'buddhist',
    timeZone: 'Asia/Bangkok',
    ...options 
  });
}

/**
 * Parse a date-only string (YYYY-MM-DD) as Bangkok midnight.
 * 
 * Problem: new Date("2026-09-29") parses as UTC midnight (Bangkok 07:00),
 * causing off-by-one-day errors when the date is used as a Bangkok boundary.
 * 
 * Fix: Extract year/month/day from string manually, then construct
 * UTC midnight using Date.UTC(), so Bangkok midnight = UTC midnight.
 */
export function parseBangkokDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Date.UTC(year, month-1, day) = UTC midnight of that Bangkok date
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Format date as short format: 20 ก.ย. 2569
 * Uses Asia/Bangkok timezone to correctly display dates.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return createBuddhistFormatter({ day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Format date as full format: วันอาทิตย์ที่ 20 กันยายน พ.ศ. 2569
 *
 * NOTE: This is the DATE part only — does NOT include time.
 * For full date+time, use `formatDateTimeFull()` instead.
 *
 * RULE: Never use this helper to display `transactions.date` or
 * `effectiveDate` because those fields are date-only and would
 * silently show 00:00 if a caller mistakenly appends a time. Use
 * `formatDateTimeFull()` with a real timestamp (createdAt /
 * receivedDate / paidDate) whenever time is needed.
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
 * Format date as FULL date + time: วันอาทิตย์ที่ 20 กันยายน พ.ศ. 2569 เวลา 20:40 น.
 *
 * RULE: Only use with a REAL timestamp that carries time-of-day:
 *   - createdAt (always present, real timestamp)
 *   - receivedDate / paidDate (settlement date — has time-of-day)
 * NEVER use with transactions.date (date-only → renders "00:00").
 *
 * Accepts Date object, ISO string, or unix seconds (number).
 */
export function formatDateTimeFull(date: Date | string | number): string {
  let d: Date;
  if (typeof date === 'number') {
    // Unix seconds (drizzle mode='timestamp') → ms
    d = new Date(date * 1000);
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }

  if (Number.isNaN(d.getTime())) return '';

  const datePart = createBuddhistFormatter({
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);

  const timePart = d.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart} เวลา ${timePart} น.`;
}

/**
 * Check if a date-time value has REAL time-of-day in Asia/Bangkok timezone.
 *
 * Use this before rendering `formatDateTimeFull()` for settlement dates
 * (receivedDate / paidDate). Returns `false` for:
 *   - null / undefined
 *   - a value whose Bangkok wall-clock time is 00:00 (legacy date-only
 *     backfill where receivedDate was set to transactions.date)
 *
 * UI rule: If this returns `false`, hide the settlement date line entirely.
 * NEVER silently fall back to "00:00 น." — it leaks the legacy
 * date-only convention into the UI.
 *
 * Type guard: narrows `T | null | undefined` to `T` so the caller can
 * safely pass the value to `formatDateTimeFull()` without a separate
 * null check.
 */
export function hasBangkokTimeOfDay<T extends Date | string | number>(
  date: T | null | undefined,
): date is T {
  if (date === null || date === undefined) return false;
  let d: Date;
  if (typeof date === 'number') {
    d = new Date(date * 1000);
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
  if (Number.isNaN(d.getTime())) return false;
  // Bangkok wall-clock hour:minute → "00:00" means legacy/date-only value
  const hh = Number(
    d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).replace(/[^0-9]/g, '')
  );
  const mm = Number(
    d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', minute: '2-digit' }).replace(/[^0-9]/g, '')
  );
  return !(Number.isNaN(hh) || Number.isNaN(mm)) && (hh !== 0 || mm !== 0);
}

/**
 * Format date range: 1 ก.ย. 2569 - 20 ก.ย. 2569
 * Returns single date if same day.
 * Uses Asia/Bangkok timezone for correct Bangkok date boundaries.
 */
export function formatDateRange(start: Date | string, end: Date | string): string {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;

  if (s.toDateString() === e.toDateString()) {
    return formatDate(s);
  }

  return `${formatDate(s)} - ${formatDate(e)}`;
}

// ============================================================
// OVERDUE CALCULATION (Asia/Bangkok timezone)
// Phase 1.2: dueDateTime-aware with legacy fallback
//
// Source of truth: dueDateTime (Phase 1 v3.0+)
// Fallback (backward compatibility): transaction.date + 1 day at 18:00 (Bangkok)
//
// Rule:
//   if dueDateTime exists:    deadline = dueDateTime
//   else (legacy/null):       deadline = date (Bangkok) + 1 day + 18:00
//   overdue = now > deadline
// ============================================================

const OVERDUE_HOUR = 18; // 18:00 Thailand time
const OVERDUE_GRACE_MINUTES = 1; // 1 minute grace period after 18:00

/**
 * Compute deadline from transaction data.
 * Priority: dueDateTime > legacy (date + 1d + 18:00 Bangkok)
 * Returns Date in UTC instant (compared against `now` directly).
 */
function computeDeadline(
  dueDateTime: Date | string | number | null | undefined,
  transactionDate: Date | string | number | null | undefined,
): Date | null {
  // 1) Phase 1 v3.0+ source of truth
  if (dueDateTime !== undefined && dueDateTime !== null) {
    const d = dueDateTime instanceof Date ? dueDateTime : new Date(dueDateTime);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 2) Legacy fallback: transaction.date (UTC) + 1 day + 18:00 (Bangkok)
  if (transactionDate !== undefined && transactionDate !== null) {
    const txDate = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
    if (Number.isNaN(txDate.getTime())) return null;

    // Build deadline as Bangkok wall-clock, then convert to UTC instant.
    // Approach: take UTC ms of txDate, add +7h to align to Bangkok, then add 1d + 18h - 7h offset
    // Equivalent to: deadlineUTC = (txDate + 7h as Bangkok-midnight) + 1d + 18h - 7h
    // Simplification: deadline = txDate + 24h + 18h - 7h = txDate + 35h (Bangkok interpretation)
    // We do it explicitly to stay readable and timezone-safe.
    const bangkokMidnightMs = txDate.getTime() + 7 * 60 * 60 * 1000; // shift +7h
    const bangkokWall = new Date(bangkokMidnightMs);
    bangkokWall.setUTCDate(bangkokWall.getUTCDate() + 1); // +1 day in Bangkok
    bangkokWall.setUTCHours(OVERDUE_HOUR, OVERDUE_GRACE_MINUTES, 0, 0); // 18:01 Bangkok
    // Now bangkokWall is a UTC instant that represents 18:01 Bangkok of (date+1day)
    return bangkokWall;
  }

  return null;
}

/**
 * Overdue check.
 * Accepts either a transaction object with {dueDateTime, date} OR
 * a single Date/string (treated as legacy transaction.date).
 */
export function isOverdue(input: TransactionLike | Date | string | null | undefined): boolean {
  const { dueDateTime, date } = normalizeOverdueInput(input);
  const deadline = computeDeadline(dueDateTime, date);
  if (!deadline) return false;

  const now = new Date();
  return now.getTime() > deadline.getTime();
}

/**
 * Overdue info with detail (days overdue, hours remaining).
 * Same input contract as isOverdue().
 */
export function getOverdueInfo(input: TransactionLike | Date | string | null | undefined): { isOverdue: boolean; daysOverdue: number; hoursUntilDeadline: number } {
  const { dueDateTime, date } = normalizeOverdueInput(input);
  const deadline = computeDeadline(dueDateTime, date);
  if (!deadline) {
    return { isOverdue: false, daysOverdue: 0, hoursUntilDeadline: 24 };
  }

  const now = new Date();
  const diffMs = now.getTime() - deadline.getTime();
  const isOverdue = diffMs > 0;

  let hoursUntilDeadline = 0;
  let daysOverdue = 0;

  if (isOverdue) {
    daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } else {
    hoursUntilDeadline = Math.floor(-diffMs / (1000 * 60 * 60));
  }

  return { isOverdue, daysOverdue, hoursUntilDeadline };
}

/**
 * Shape accepted by isOverdue/getOverdueInfo.
 * Both fields optional — falls back to legacy when dueDateTime missing.
 */
type TransactionLike = {
  dueDateTime?: Date | string | number | null;
  date?: Date | string | number | null;
};

function normalizeOverdueInput(input: TransactionLike | Date | string | null | undefined): {
  dueDateTime: Date | string | number | null | undefined;
  date: Date | string | number | null | undefined;
} {
  if (input === null || input === undefined) {
    return { dueDateTime: undefined, date: undefined };
  }
  if (input instanceof Date || typeof input === 'string' || typeof input === 'number') {
    // Legacy single-arg call: treat as transaction.date
    return { dueDateTime: undefined, date: input };
  }
  return { dueDateTime: input.dueDateTime, date: input.date };
}

// ============================================================
// BANGKOK TIME HELPERS (used by both Client and Server)
// ============================================================

/**
 * Get current date in Bangkok timezone (YYYY-MM-DD format)
 */
export function getBangkokDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // en-CA gives YYYY-MM-DD
}

/**
 * Extract Bangkok date string from any date (for sorting by Business Date)
 * @param dateStr - ISO date string, timestamp (seconds), or Date object
 * @returns Bangkok date in YYYY-MM-DD format
 */
export function toBangkokDateString(dateStr: string | number | Date): string {
  let d: Date;
  if (dateStr instanceof Date) {
    d = dateStr;
  } else if (typeof dateStr === 'number') {
    // Unix timestamp in seconds from Drizzle
    d = new Date(dateStr * 1000);
  } else {
    d = new Date(dateStr);
  }
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/**
 * Get current datetime in Bangkok timezone as ISO string
 */
export function getBangkokISOString(): string {
  const now = new Date();
  const bangkokStr = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour12: false });
  return new Date(bangkokStr).toISOString();
}

// ============================================================
// EFFECTIVE DATE (Phase B v3.0 — Settlement Date Display)
// Used by: Transactions List, Detail Modal, Sort, Filter
// ============================================================

/**
 * Shape for getEffectiveDate input.
 * Mirrors the Transaction type fields used.
 */
export type EffectiveDateInput = {
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  businessStatus?: 'pending' | 'received' | null;
  date: string;
  receivedDate?: string | null;
  paidDate?: string | null;
};

/**
 * Get effective date for display/sort/filter.
 *
 * Rules:
 * - pending → use date (Business Date)
 * - completed + income + receivedDate → use receivedDate (Settlement Date)
 * - completed + expense + paidDate → use paidDate (Settlement Date)
 * - completed but no settlement date yet → fallback to date
 *
 * Returns a Date object (UTC), compatible with toBangkokDateString() for sorting.
 */
export function getEffectiveDate(tx: EffectiveDateInput): Date {
  if (tx.businessStatus === 'pending') {
    return new Date(tx.date);
  }

  // Completed transactions: use settlement date
  if (tx.type === 'income' && tx.receivedDate) {
    return new Date(tx.receivedDate);
  }
  if (tx.type === 'expense' && tx.paidDate) {
    return new Date(tx.paidDate);
  }

  // Fallback to business date
  return new Date(tx.date);
}

/**
 * Format effective date for display (short format: 20 ก.ย. 2569).
 * Wraps getEffectiveDate + formatDate for convenience.
 */
export function formatEffectiveDate(tx: EffectiveDateInput): string {
  return formatDate(getEffectiveDate(tx));
}

/**
 * Format effective date for display (full format with time: วันจันทร์ที่ 20 กันยายน พ.ศ. 2569 เวลา 20:40 น.).
 * Includes time component from the settlement date.
 */
export function formatEffectiveDateFull(tx: EffectiveDateInput): string {
  const effective = getEffectiveDate(tx);
  const datePart = createBuddhistFormatter({
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(effective);

  // Format time separately (24-hour, Bangkok)
  const timePart = effective.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart} เวลา ${timePart} น.`;
}
