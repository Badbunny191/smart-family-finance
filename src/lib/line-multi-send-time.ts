/**
 * Multi-SendTime Helpers
 *
 * Additive enhancement — does NOT change existing types/schemas.
 *
 * Public API (existing — unchanged):
 * - isValidHHmm(time):      validate "HH:mm" string
 * - normalizeSettings(raw): read raw JSON safely (additionalTimes defaults to [])
 * - effectiveSlots(s):      derive [sendTime, ...additionalTimes] (sorted asc, deduped)
 * - prepareForSave(times):  split [sendTime, ...additionalTimes] for API PATCH
 *
 * Public API (NEW — slot-level dedup via _slotHistory in settings JSON):
 * - hasSlotSentToday():     check whether a slot was already sent today
 * - appendSlotHistory():    push new slot for today (deduped, sorted)
 * - cleanupSlotHistory():   purge keys older than 3 days (today + 2 days back)
 * - writeSlotHistoryIfChanged(): decide whether to write to DB
 * - bangkokDateMinusDays(): pure date math (returns dd/mm/yyyy+BE)
 *
 * Backward compat:
 * - Existing settings without `additionalTimes` → defaults to []
 * - Existing settings without `_slotHistory` → treated as {} (empty)
 * - If additionalTimes is empty, effectiveSlots returns [sendTime]
 * - Cron loop continues to work even with single slot
 */

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validate HH:mm format (00:00 - 23:59)
 */
export function isValidHHmm(time: unknown): time is string {
  return typeof time === 'string' && HHMM_RE.test(time);
}

/**
 * Safely read raw settings JSON from DB.
 * Always returns an object with `additionalTimes` defaulted to [].
 */
export function normalizeSettings(raw: unknown): {
  sendTime: string;
  additionalTimes: string[];
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
} {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // sendTime: validate or fallback to empty (caller decides)
  const sendTime = isValidHHmm(s.sendTime) ? s.sendTime : '';

  // additionalTimes: filter invalid entries, default to []
  const additionalRaw = Array.isArray(s.additionalTimes) ? s.additionalTimes : [];
  const additionalTimes = additionalRaw.filter(isValidHHmm);

  // Boolean fields default true for visibility (match DEFAULT_DAILY_SUMMARY_SETTINGS)
  return {
    sendTime,
    additionalTimes,
    showBalance: typeof s.showBalance === 'boolean' ? s.showBalance : true,
    showIncome: typeof s.showIncome === 'boolean' ? s.showIncome : true,
    showExpense: typeof s.showExpense === 'boolean' ? s.showExpense : true,
    showNet: typeof s.showNet === 'boolean' ? s.showNet : true,
    showPending: typeof s.showPending === 'boolean' ? s.showPending : true,
    showOverdue: typeof s.showOverdue === 'boolean' ? s.showOverdue : true,
    showPendingDetails:
      typeof s.showPendingDetails === 'boolean' ? s.showPendingDetails : true,
    showOverdueDetails:
      typeof s.showOverdueDetails === 'boolean' ? s.showOverdueDetails : true,
  };
}

/**
 * Derive the list of slots to actually send for a recipient.
 * - Always includes `sendTime` (primary, even if additionalTimes is empty)
 * - If `additionalTimes` is empty, returns [sendTime]
 * - Returns array sorted ascending, deduplicated
 *
 * @example
 *   effectiveSlots({ sendTime: "20:00", additionalTimes: ["08:00", "12:00"] })
 *   → ["08:00", "12:00", "20:00"]
 */
export function effectiveSlots(settings: {
  sendTime: string;
  additionalTimes?: string[];
}): string[] {
  const sendTime = isValidHHmm(settings.sendTime) ? settings.sendTime : '';
  const extras = (settings.additionalTimes ?? []).filter(isValidHHmm);

  // Combine, dedup, sort asc
  const merged = Array.from(new Set<string>([sendTime, ...extras].filter(Boolean)));
  merged.sort();
  return merged;
}

/**
 * Split UI list into sendTime + additionalTimes for API PATCH.
 * - Validates each HH:mm
 * - Deduplicates
 * - Sorts ascending
 * - First entry becomes `sendTime`, the rest become `additionalTimes`
 *
 * @example
 *   prepareForSave(["20:00", "08:00", "12:00", "08:00"])
 *   → { sendTime: "08:00", additionalTimes: ["12:00", "20:00"] }
 *
 *   prepareForSave([])  → { sendTime: "", additionalTimes: [] }
 */
export function prepareForSave(times: string[]): {
  sendTime: string;
  additionalTimes: string[];
} {
  const valid = times.filter(isValidHHmm);
  const unique = Array.from(new Set(valid));
  unique.sort();

  const [sendTime, ...additionalTimes] = unique;
  return {
    sendTime: sendTime ?? '',
    additionalTimes,
  };
}

// ============================================================
// SLOT HISTORY (slot-level dedup via settings JSON)
// ============================================================

/**
 * Type alias for slot history stored in settings._slotHistory.
 * Key: Bangkok date string "dd/mm/yyyy+BE"
 * Value: Array of HH:mm slots that were successfully sent on that date.
 */
export type SlotHistory = Record<string, string[]>;

/**
 * Retention window: keep today + 2 days back = 3 days total.
 * Cleanup will purge any keys with date < (today - 2).
 */
export const SLOT_HISTORY_RETENTION_DAYS = 3;

/**
 * Read `_slotHistory` from a settings object (unknown shape) safely.
 * Returns {} if absent or malformed — never throws.
 */
export function readSlotHistory(raw: unknown): SlotHistory {
  if (!raw || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  const hist = s._slotHistory;
  if (!hist || typeof hist !== 'object') return {};
  const out: SlotHistory = {};
  for (const [dateKey, slots] of Object.entries(hist as Record<string, unknown>)) {
    if (typeof dateKey !== 'string' || !Array.isArray(slots)) continue;
    const validSlots = slots.filter(isValidHHmm);
    if (validSlots.length === 0) continue;
    out[dateKey] = Array.from(new Set(validSlots)).sort();
  }
  return out;
}

/**
 * Pure check: was `slot` already sent on `today` (Bangkok date string)?
 * Empty/missing history → false.
 */
export function hasSlotSentToday(
  rawSettings: unknown,
  slot: string,
  today: string
): boolean {
  if (!isValidHHmm(slot) || typeof today !== 'string' || today.length === 0) return false;
  const history = readSlotHistory(rawSettings);
  const sentToday = history[today];
  if (!Array.isArray(sentToday)) return false;
  return sentToday.includes(slot);
}

/**
 * Pure: append `slot` to today's bucket in history.
 * - Dedup (no duplicates)
 * - Sort ascending
 * - Returns NEW history object (does NOT mutate input)
 * - Returns same reference if nothing changed
 */
export function appendSlotHistory(
  history: SlotHistory,
  today: string,
  slot: string
): SlotHistory {
  if (!isValidHHmm(slot) || typeof today !== 'string' || today.length === 0) {
    return history;
  }
  const existing = history[today] ?? [];
  if (existing.includes(slot)) {
    return history; // already recorded — no-op
  }
  const next = [...existing, slot].sort();
  return { ...history, [today]: next };
}

/**
 * Pure: purge keys with date < cutoff (inclusive of cutoff is kept).
 * Returns NEW history object (does NOT mutate input).
 *
 * @param history - current slot history
 * @param cutoffDate - Bangkok date string; dates < this are removed
 */
export function purgeSlotHistoryBefore(
  history: SlotHistory,
  cutoffDate: string
): SlotHistory {
  if (typeof cutoffDate !== 'string' || cutoffDate.length === 0) return history;
  const kept: SlotHistory = {};
  let removed = 0;
  for (const [k, v] of Object.entries(history)) {
    if (k >= cutoffDate) {
      // string comparison works because format is fixed-width dd/mm/yyyy+BE
      kept[k] = v;
    } else {
      removed++;
    }
  }
  return removed === 0 ? history : kept;
}

/**
 * Bangkok date math: returns `bangkokDateString(now)` shifted back by `days`.
 * Pure — does not mutate input.
 *
 * @param today - Bangkok date string in "dd/mm/yyyy+BE" format
 * @param days  - number of days to subtract (positive = past)
 * @returns      Bangkok date string "dd/mm/yyyy+BE"
 */
export function bangkokDateMinusDays(today: string, days: number): string {
  if (typeof today !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(today)) {
    return today; // guard: malformed input → return as-is
  }
  const [dStr, mStr, yStr] = today.split('/');
  const day = parseInt(dStr, 10);
  const month = parseInt(mStr, 10);
  const yearBE = parseInt(yStr, 10);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(yearBE)) {
    return today;
  }
  const yearCE = yearBE - 543;
  // Use UTC to avoid local timezone shifting across midnight
  const utc = new Date(Date.UTC(yearCE, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - days);
  const outDay = String(utc.getUTCDate()).padStart(2, '0');
  const outMonth = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const outYearBE = utc.getUTCFullYear() + 543;
  return `${outDay}/${outMonth}/${outYearBE}`;
}

/**
 * Convenience: cleanup using the configured retention window (3 days).
 * Equivalent to purgeSlotHistoryBefore(history, bangkokDateMinusDays(today, 2)).
 */
export function cleanupSlotHistory(
  history: SlotHistory,
  today: string
): SlotHistory {
  const cutoff = bangkokDateMinusDays(today, SLOT_HISTORY_RETENTION_DAYS - 1);
  return purgeSlotHistoryBefore(history, cutoff);
}

/**
 * Conditional write decision:
 * Returns true if the candidate history differs from the current (i.e., something
 * was appended OR something was purged). Caller can use this to skip DB writes.
 */
export function shouldWriteSlotHistory(
  current: SlotHistory,
  candidate: SlotHistory
): boolean {
  const a = Object.keys(current).length;
  const b = Object.keys(candidate).length;
  if (a !== b) return true;
  for (const k of Object.keys(candidate)) {
    const aSlots = current[k] ?? [];
    const bSlots = candidate[k];
    if (aSlots.length !== bSlots.length) return true;
    for (let i = 0; i < bSlots.length; i++) {
      if (aSlots[i] !== bSlots[i]) return true;
    }
  }
  return false;
}

/**
 * Composite helper used by cron: given current history + today + slot,
 * returns { next, changed } where `next` is the cleaned+appended history
 * and `changed` tells the caller whether to persist.
 */
export function applySlotHistoryUpdate(args: {
  currentHistory: SlotHistory;
  today: string;
  slot: string;
}): { next: SlotHistory; changed: boolean } {
  const cleaned = cleanupSlotHistory(args.currentHistory, args.today);
  const appended = appendSlotHistory(cleaned, args.today, args.slot);
  const changed = shouldWriteSlotHistory(args.currentHistory, appended);
  return { next: appended, changed };
}
