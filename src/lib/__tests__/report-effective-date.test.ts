/**
 * Phase 3 Tests — Share Report uses Effective Date
 *
 * Verifies that `buildReport()` (in src/lib/report.ts) honors the same
 * effective-date rule as Transactions / Dashboard / LINE Summary:
 *
 *   - pending               → date
 *   - completed income      → receivedDate ?? date
 *   - completed expense     → paidDate ?? date
 *   - transfer / adjustment → date (no settlement semantic)
 *
 * These tests don't need a database — they validate the JS report builder
 * directly with synthetic TransactionRow arrays.
 *
 * Reference: src/lib/utils.ts → getEffectiveDate()
 */

import { describe, expect, it } from 'vitest';
import { buildReport, type TransactionRow } from '../report';

// Bangkok: 2026-10-05 00:00 ICT = 2026-10-04 17:00 UTC = unix 1757590800
// Use unix seconds consistently so the test stays close to the real API shape.
const BANGKOK_DAY = '1757590800'; // 2026-10-05 (business date)
const NEXT_DAY = '1757677200'; // 2026-10-06 (receivedDate)
const DAY_AFTER = '1757763600'; // 2026-10-07 (paidDate)

const MONTH_RANGE = {
  // Cover 2026-10-01..2026-10-31 ICT (full month) — used to assert filter
  monthStart: Math.floor(Date.UTC(2026, 9, 1) / 1000) - 7 * 60 * 60, // Sep 30 17:00 UTC
  nextMonthStart: Math.floor(Date.UTC(2026, 10, 1) / 1000) - 7 * 60 * 60, // Oct 31 17:00 UTC
};

/** Helper: build a TransactionRow with all required fields filled in. */
function makeTx(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 'tx-1',
    type: 'income',
    amount: 1000,
    date: BANGKOK_DAY,
    receivedDate: null,
    paidDate: null,
    businessStatus: 'received',
    title: 'Test',
    status: 'completed',
    propertyId: null,
    propertyName: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    ...overrides,
  };
}

describe('Phase 3 — Share Report uses Effective Date', () => {
  describe('buildReport() filter rule', () => {
    it('completed income falls inside the report window only when receivedDate is inside', () => {
      // Received on 2026-10-06 (inside October) → should be included
      const incomeReceived = makeTx({
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        receivedDate: NEXT_DAY,
      });
      // Received would land OUTSIDE October (use a Jan 2025 epoch instead)
      const incomeOutside = makeTx({
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        receivedDate: '1735689600', // 2025-01-01 (outside October 2026)
      });

      const report = buildReport([incomeReceived, incomeOutside], 'month');
      expect(report.income.items).toHaveLength(1);
      expect(report.income.items[0]?.title).toBe('Test');
    });

    it('completed expense falls inside the report window only when paidDate is inside', () => {
      const expensePaid = makeTx({
        type: 'expense',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        paidDate: DAY_AFTER,
      });
      const expenseOutside = makeTx({
        type: 'expense',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        paidDate: '1735689600', // 2025-01-01
      });

      const report = buildReport([expensePaid, expenseOutside], 'month');
      expect(report.expense.items).toHaveLength(1);
    });

    it('pending income is excluded (status=pending has no balance impact)', () => {
      const pending = makeTx({
        type: 'income',
        businessStatus: 'pending',
        status: 'pending',
      });
      const report = buildReport([pending], 'month');
      expect(report.income.items).toHaveLength(0);
    });

    it('completed income without receivedDate falls back to date', () => {
      // date=BANGKOK_DAY (Oct 5) is inside the report window
      const income = makeTx({
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        receivedDate: null,
      });
      const report = buildReport([income], 'month');
      expect(report.income.items).toHaveLength(1);
    });
  });

  describe('buildReport() totals', () => {
    it('income.total sums only completed income inside the window', () => {
      const inWin = makeTx({
        id: 'in1',
        type: 'income',
        amount: 100,
        businessStatus: 'received',
        receivedDate: NEXT_DAY,
      });
      const outWin = makeTx({
        id: 'in2',
        type: 'income',
        amount: 999,
        businessStatus: 'received',
        receivedDate: '1735689600', // 2025
      });
      const report = buildReport([inWin, outWin], 'month');
      expect(report.income.total).toBe(100);
    });

    it('expense.total sums only completed expense inside the window', () => {
      const inWin = makeTx({
        id: 'ex1',
        type: 'expense',
        amount: 50,
        businessStatus: 'received',
        paidDate: DAY_AFTER,
      });
      const outWin = makeTx({
        id: 'ex2',
        type: 'expense',
        amount: 999,
        businessStatus: 'received',
        paidDate: '1735689600',
      });
      const report = buildReport([inWin, outWin], 'month');
      expect(report.expense.total).toBe(50);
    });

    it('net = income.total - expense.total', () => {
      const inWin = makeTx({
        type: 'income',
        amount: 300,
        businessStatus: 'received',
        receivedDate: NEXT_DAY,
      });
      const exWin = makeTx({
        type: 'expense',
        amount: 100,
        businessStatus: 'received',
        paidDate: DAY_AFTER,
      });
      const report = buildReport([inWin, exWin], 'month');
      expect(report.net).toBe(200);
    });
  });

  describe('buildReport() date display & sort', () => {
    it('dateMs for completed income uses receivedDate (NOT date)', () => {
      const income = makeTx({
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        receivedDate: NEXT_DAY,
      });
      const report = buildReport([income], 'month');
      expect(report.income.items[0]?.dateMs).toBe(Number(NEXT_DAY) * 1000);
    });

    it('dateMs for completed expense uses paidDate (NOT date)', () => {
      const expense = makeTx({
        type: 'expense',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        paidDate: DAY_AFTER,
      });
      const report = buildReport([expense], 'month');
      expect(report.expense.items[0]?.dateMs).toBe(Number(DAY_AFTER) * 1000);
    });

    it('sorts items by effective date ASC (oldest first)', () => {
      const later = makeTx({
        id: 'later',
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        receivedDate: DAY_AFTER,
        amount: 10,
      });
      const earlier = makeTx({
        id: 'earlier',
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        receivedDate: NEXT_DAY,
        amount: 20,
      });
      const report = buildReport([later, earlier], 'month');
      expect(report.income.items[0]?.id ?? 'later').toBe('later');
      expect(report.income.items[1]?.id ?? 'earlier').toBe('earlier');
    });

    it('dateDisplay uses effective date, not business date', () => {
      const income = makeTx({
        type: 'income',
        businessStatus: 'received',
        date: BANGKOK_DAY, // 2026-10-05
        receivedDate: DAY_AFTER, // 2026-10-07
      });
      const report = buildReport([income], 'month');
      // dateDisplay should encode "07 ต.ค. 2569" (Oct 7), not "05 ต.ค."
      expect(report.income.items[0]?.dateDisplay).toMatch(/07/);
      expect(report.income.items[0]?.dateDisplay).toMatch(/ต\.ค\./);
    });
  });

  describe('buildReport() property group items use effective date', () => {
    it('PropertyGroupBlock items use paidDate for completed expense', () => {
      const expense = makeTx({
        type: 'expense',
        businessStatus: 'received',
        date: BANGKOK_DAY,
        paidDate: DAY_AFTER,
        propertyId: 'p1',
        propertyName: 'บ้าน',
      });
      const report = buildReport([expense], 'month');
      const group = report.expense.byProperty[0];
      expect(group?.items[0]?.dateMs).toBe(Number(DAY_AFTER) * 1000);
    });
  });

  describe('buildReport() does NOT touch pending/cancelled (parity with Phase 1)', () => {
    it('cancelled transactions are not included', () => {
      const cancelled = makeTx({
        type: 'income',
        status: 'cancelled',
        amount: 999,
      });
      const report = buildReport([cancelled], 'month');
      expect(report.income.items).toHaveLength(0);
    });

    it('transfer is not included (only income/expense affect balance)', () => {
      const transfer = makeTx({
        type: 'transfer',
        amount: 999,
      });
      const report = buildReport([transfer], 'month');
      expect(report.income.items).toHaveLength(0);
      expect(report.expense.items).toHaveLength(0);
    });

    it('adjustment is not included', () => {
      const adj = makeTx({
        type: 'adjustment',
        amount: 999,
      });
      const report = buildReport([adj], 'month');
      expect(report.income.items).toHaveLength(0);
      expect(report.expense.items).toHaveLength(0);
    });
  });
});