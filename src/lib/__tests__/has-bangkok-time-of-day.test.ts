/**
 * Tests for hasBangkokTimeOfDay + formatDateTimeFull
 *
 * Covers the legacy backfill scenario where receivedDate/paidDate was
 * populated with transactions.date (a Bangkok-midnight value that
 * formats as "00:00 น." in Bangkok timezone). UI must NOT render that
 * "00:00 น." line — instead hide it entirely so the user only sees
 * real settlement timestamps.
 *
 * Reference: src/lib/utils.ts
 */

import { describe, expect, it } from 'vitest';
import { formatDateTimeFull, hasBangkokTimeOfDay } from '../utils';

// UTC 2026-10-03T08:08:00Z = Bangkok 2026-10-03 15:08 (real user-set)
const USER_SET_15_08_BANGKOK = 1790989680;

// UTC 2026-10-02T17:00:00Z = Bangkok 2026-10-03 00:00 (Bangkok-midnight instant)
const BKK_MIDNIGHT_INSTANT = 1790960400;

// UTC 2026-10-03T00:00:00Z = Bangkok 2026-10-03 07:00 (legacy date-only backfill:
// transactions.date is stored as Date.UTC(...) so this is what the migration
// actually wrote to received_date for legacy records)
const LEGACY_BACKFILL_VALUE = 1790985600;

describe('hasBangkokTimeOfDay', () => {
  it('returns false for null', () => {
    expect(hasBangkokTimeOfDay(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasBangkokTimeOfDay(undefined)).toBe(false);
  });

  it('returns false when Bangkok wall-clock is 00:00 (date-only value)', () => {
    // The user-reported 00:00 bug case: a value whose Bangkok wall-clock
    // is 00:00 must NOT render the time line.
    expect(hasBangkokTimeOfDay(BKK_MIDNIGHT_INSTANT)).toBe(false);
  });

  it('returns true for legacy backfill (Bangkok 07:00)', () => {
    // After the migration ran, received_date = date = Date.UTC(...) which
    // gives Bangkok 07:00. This is NOT 00:00 so the line would render with
    // "07:00 น." — we accept that because the user actually has time-of-day
    // info, even if it's not the true receipt time. The 00:00 case is the
    // one we must guard against.
    expect(hasBangkokTimeOfDay(LEGACY_BACKFILL_VALUE)).toBe(true);
  });

  it('returns true for real user-set timestamp (15:08 Bangkok)', () => {
    expect(hasBangkokTimeOfDay(USER_SET_15_08_BANGKOK)).toBe(true);
  });

  it('returns true for ISO string at non-zero Bangkok time', () => {
    // 2026-10-03 08:08 UTC = 15:08 Bangkok
    const isoNonMidnight = '2026-10-03T08:08:00.000Z';
    expect(hasBangkokTimeOfDay(isoNonMidnight)).toBe(true);
  });

  it('returns true for Date object at non-zero Bangkok time', () => {
    const d = new Date(USER_SET_15_08_BANGKOK * 1000);
    expect(hasBangkokTimeOfDay(d)).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(hasBangkokTimeOfDay('not-a-date')).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(hasBangkokTimeOfDay(NaN)).toBe(false);
  });
});

describe('formatDateTimeFull', () => {
  it('formats user-set timestamp with non-zero time correctly', () => {
    // UTC 2026-10-03 08:08 = Bangkok 15:08
    const result = formatDateTimeFull(USER_SET_15_08_BANGKOK);
    expect(result).toMatch(/08:08/);
    expect(result).toMatch(/ตุลาคม/);
    expect(result).toMatch(/2569/);
    expect(result).toMatch(/เวลา 08:08 น\./);
  });

  it('formats midnight Bangkok as 00:00 (caller must guard with hasBangkokTimeOfDay)', () => {
    // This documents the contract: formatDateTimeFull does NOT guard
    // against midnight values. Callers must use hasBangkokTimeOfDay first.
    const result = formatDateTimeFull(BKK_MIDNIGHT_INSTANT);
    expect(result).toMatch(/00:00/);
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateTimeFull(NaN)).toBe('');
  });
});
