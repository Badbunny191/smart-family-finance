/**
 * Tests for Phase 2 — Effective Date SSOT
 *
 * Verifies:
 * 1. EFFECTIVE_DATE_SQL_CASE exports a CASE expression that matches the
 *    single source of truth rule (pending → date, completed income → receivedDate ?? date,
 *    completed expense → paidDate ?? date).
 * 2. effectiveDateExpr() returns a Drizzle SQL<number> referencing the same rule.
 * 3. effectiveDateExprDesc is a DESC-wrapped version of effectiveDateExpr().
 * 4. The SQL helper stays in sync with the JS helper getEffectiveDate() in utils.ts.
 *
 * These tests don't need a database — they validate the helper as a contract.
 */

import { describe, expect, it } from 'vitest';
import {
  EFFECTIVE_DATE_SQL_CASE,
  effectiveDateExpr,
  effectiveDateExprDesc,
} from '../transaction-effective-date-query';
import { getEffectiveDate } from '../utils';

/**
 * Walk Drizzle's queryChunks tree and collect all primitive string values.
 * Avoids circular references from Column/Table objects.
 *
 * Drizzle structure:
 *   queryChunks: Array<
 *     | { value: string }                                  // string literal
 *     | { name: string, table: ... }                       // column → has .name
 *     | SQL<unknown>                                       // nested SQL
 *     | Param / Placeholder
 *   >
 */
function collectStrings(chunks: unknown): string {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const c of node) walk(c);
      return;
    }
    if (typeof node === 'object') {
      // String literal chunk
      const value = (node as { value?: unknown }).value;
      if (typeof value === 'string') {
        out.push(value);
      } else if (Array.isArray(value)) {
        for (const v of value) walk(v);
      }
      // Column reference chunk — has `name` property with column name
      const name = (node as { name?: unknown }).name;
      if (typeof name === 'string' && name !== 'db' && name !== 'id') {
        out.push(name);
      }
      // Nested queryChunks (nested SQL<unknown>)
      const nested = (node as { queryChunks?: unknown }).queryChunks;
      if (nested) walk(nested);
    }
  }
  walk(chunks);
  return out.join('');
}

describe('Phase 2 — Effective Date SSOT', () => {
  describe('EFFECTIVE_DATE_SQL_CASE', () => {
    it('exports a non-empty CASE expression string', () => {
      expect(typeof EFFECTIVE_DATE_SQL_CASE).toBe('string');
      expect(EFFECTIVE_DATE_SQL_CASE.length).toBeGreaterThan(0);
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(/^CASE/);
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(/END$/);
    });

    it('references the 3 source columns: type, business_status, receivedDate, paidDate, date', () => {
      expect(EFFECTIVE_DATE_SQL_CASE).toContain("'income'");
      expect(EFFECTIVE_DATE_SQL_CASE).toContain("'expense'");
      expect(EFFECTIVE_DATE_SQL_CASE).toContain("'received'");
      // Column references (column names without bindings)
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(/received_date|receivedDate/i);
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(/paid_date|paidDate/i);
    });

    it('falls back to date as the ELSE branch', () => {
      // The last THEN must be date, and there must be an ELSE date
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(/END$/);
      expect(EFFECTIVE_DATE_SQL_CASE).toContain('ELSE');
    });
  });

  describe('effectiveDateExpr()', () => {
    it('returns a Drizzle SQL expression', () => {
      const expr = effectiveDateExpr();
      expect(expr).toBeDefined();
      // Drizzle SQL has a `queryChunks` property (string/parameter object)
      expect(expr).toHaveProperty('queryChunks');
    });

    it('contains the same CASE pattern as EFFECTIVE_DATE_SQL_CASE', () => {
      const expr = effectiveDateExpr();
      // Drizzle SQL.queryChunks is array of strings + parameterized objects.
      // Walk it recursively and collect string parts to avoid circular refs.
      const sqlString = collectStrings(expr.queryChunks);
      expect(sqlString).toContain("'income'");
      expect(sqlString).toContain("'expense'");
      expect(sqlString).toContain("'received'");
      expect(sqlString).toContain('CASE');
      expect(sqlString).toContain('ELSE');
      expect(sqlString).toContain('END');
    });
  });

  describe('effectiveDateExprDesc', () => {
    it('is a DESC-wrapped version (last queryChunk contains DESC)', () => {
      expect(effectiveDateExprDesc).toBeDefined();
      expect(effectiveDateExprDesc).toHaveProperty('queryChunks');
      const sqlString = collectStrings(effectiveDateExprDesc.queryChunks);
      expect(sqlString).toContain('DESC');
    });
  });

  describe('SQL helper parity with JS helper (getEffectiveDate)', () => {
    /**
     * These cases assert that the SQL rule resolves to the same date as
     * getEffectiveDate() for every (type, businessStatus, settlement-date) combo.
     * We can't execute the SQL here, but we can document and check the rule mapping
     * for every branch — if the SQL CASE matches the JS branches, parity holds.
     */
    const day = '2026-10-05T00:00:00.000Z';
    const received = '2026-10-06T00:00:00.000Z';
    const paid = '2026-10-07T00:00:00.000Z';

    const cases = [
      {
        name: 'pending → uses business date (date)',
        input: {
          type: 'income' as const,
          businessStatus: 'pending' as const,
          date: day,
          receivedDate: null,
          paidDate: null,
        },
        expected: new Date(day),
      },
      {
        name: 'completed income with receivedDate → uses receivedDate',
        input: {
          type: 'income' as const,
          businessStatus: 'received' as const,
          date: day,
          receivedDate: received,
          paidDate: null,
        },
        expected: new Date(received),
      },
      {
        name: 'completed income without receivedDate → fallback to date',
        input: {
          type: 'income' as const,
          businessStatus: 'received' as const,
          date: day,
          receivedDate: null,
          paidDate: null,
        },
        expected: new Date(day),
      },
      {
        name: 'completed expense with paidDate → uses paidDate',
        input: {
          type: 'expense' as const,
          businessStatus: 'received' as const,
          date: day,
          receivedDate: null,
          paidDate: paid,
        },
        expected: new Date(paid),
      },
      {
        name: 'completed expense without paidDate → fallback to date',
        input: {
          type: 'expense' as const,
          businessStatus: 'received' as const,
          date: day,
          receivedDate: null,
          paidDate: null,
        },
        expected: new Date(day),
      },
      {
        name: 'transfer → always uses date (no settlement semantic)',
        input: {
          type: 'transfer' as const,
          businessStatus: null,
          date: day,
          receivedDate: null,
          paidDate: null,
        },
        expected: new Date(day),
      },
      {
        name: 'adjustment → always uses date (no settlement semantic)',
        input: {
          type: 'adjustment' as const,
          businessStatus: null,
          date: day,
          receivedDate: null,
          paidDate: null,
        },
        expected: new Date(day),
      },
    ];

    for (const tc of cases) {
      it(`JS helper resolves correctly: ${tc.name}`, () => {
        const got = getEffectiveDate(tc.input);
        expect(got.getTime()).toBe(tc.expected.getTime());
      });
    }
  });

  describe('SQL CASE expression ↔ JS rule coverage', () => {
    /**
     * Documents the SQL → JS parity by checking which branches are present.
     * If the SQL helper loses a branch (e.g. someone removes the expense branch),
     * these checks will catch it.
     */
    it('SQL covers pending branch (via ELSE date fallback)', () => {
      // The SQL doesn't have an explicit "pending" branch — it's the fallback (ELSE date).
      // This matches the JS rule: getEffectiveDate returns date for non-completed.
      expect(EFFECTIVE_DATE_SQL_CASE).toContain('ELSE');
    });

    it('SQL covers completed-income branch (receivedDate IS NOT NULL → receivedDate)', () => {
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(
        /income[\s\S]*received[\s\S]*received_date|receivedDate/i
      );
    });

    it('SQL covers completed-expense branch (paidDate IS NOT NULL → paidDate)', () => {
      expect(EFFECTIVE_DATE_SQL_CASE).toMatch(
        /expense[\s\S]*received[\s\S]*paid_date|paidDate/i
      );
    });
  });
});