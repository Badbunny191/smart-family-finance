/**
 * Behavior Parity Tests: Hardcoded vs Helper
 *
 * Verifies that the refactored logic (using getBalanceImpact / getTransferImpact)
 * produces EXACTLY the same balance updates as the original hardcoded logic.
 *
 * This test serves as a regression guard for the refactor:
 * If any future change breaks the parity, this test will fail.
 */

import {
  getBalanceImpact,
  getTransferImpact,
  type TransactionForBalance,
} from '@/lib/transaction-balance';

// ============================================================================
// Reference: Original hardcoded logic (BEFORE refactor)
// ============================================================================

function originalBalanceUpdates(
  type: 'income' | 'expense' | 'transfer' | 'adjustment',
  amount: number,
  adjustmentDirection: 'increase' | 'decrease' | null | undefined,
  sourceAccountId: string | null | undefined,
  destinationAccountId: string | null | undefined
): { accountId: string; delta: number }[] {
  const updates: { accountId: string; delta: number }[] = [];

  // expense, transfer = subtract from source
  if ((type === 'expense' || type === 'transfer') && sourceAccountId) {
    updates.push({ accountId: sourceAccountId, delta: -amount });
  }
  // income, transfer = add to destination
  if ((type === 'income' || type === 'transfer') && destinationAccountId) {
    updates.push({ accountId: destinationAccountId, delta: amount });
  }
  // adjustment
  if (type === 'adjustment' && sourceAccountId) {
    const delta = adjustmentDirection === 'increase' ? amount : -amount;
    updates.push({ accountId: sourceAccountId, delta });
  }

  return updates;
}

// ============================================================================
// Refactored: Uses helper functions (AFTER refactor)
// ============================================================================

function refactoredBalanceUpdates(
  type: 'income' | 'expense' | 'transfer' | 'adjustment',
  amount: number,
  adjustmentDirection: 'increase' | 'decrease' | null | undefined,
  sourceAccountId: string | null | undefined,
  destinationAccountId: string | null | undefined
): { accountId: string; delta: number }[] {
  const updates: { accountId: string; delta: number }[] = [];

  const completedTx: TransactionForBalance = {
    type,
    amount,
    status: 'completed',
    adjustmentDirection: adjustmentDirection ?? null,
    sourceAccountId: sourceAccountId ?? null,
    destinationAccountId: destinationAccountId ?? null,
  };

  if (type === 'transfer') {
    if (sourceAccountId) {
      const impact = getTransferImpact(completedTx, sourceAccountId);
      if (impact !== 0) updates.push({ accountId: sourceAccountId, delta: impact });
    }
    if (destinationAccountId) {
      const impact = getTransferImpact(completedTx, destinationAccountId);
      if (impact !== 0) updates.push({ accountId: destinationAccountId, delta: impact });
    }
  } else {
    if (type === 'income' && destinationAccountId) {
      const impact = getBalanceImpact(completedTx);
      if (impact !== 0) updates.push({ accountId: destinationAccountId, delta: impact });
    }
    if ((type === 'expense' || type === 'adjustment') && sourceAccountId) {
      const impact = getBalanceImpact(completedTx);
      if (impact !== 0) updates.push({ accountId: sourceAccountId, delta: impact });
    }
  }

  return updates;
}

// ============================================================================
// Parity Tests
// ============================================================================

/**
 * Helper: Apply a list of {accountId, delta} updates to a balance map.
 * Returns the final balance state.
 */
function applyUpdates(
  initial: Record<string, number>,
  updates: { accountId: string; delta: number }[]
): Record<string, number> {
  const result = { ...initial };
  for (const u of updates) {
    result[u.accountId] = (result[u.accountId] ?? 0) + u.delta;
  }
  return result;
}

describe('Behavior Parity: Original hardcoded === Refactored helper', () => {
  const SRC = 'src-account';
  const DST = 'dst-account';
  const AMOUNT = 1000;

  describe('Income', () => {
    it('income with source+destination: only destination gets +amount', () => {
      const original = originalBalanceUpdates('income', AMOUNT, null, SRC, DST);
      const refactored = refactoredBalanceUpdates('income', AMOUNT, null, SRC, DST);

      // Verify FINAL BALANCE state is identical (not statement count)
      const before = { [SRC]: 1000, [DST]: 2000 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);
      expect(refactFinal).toEqual(origFinal);
      expect(origFinal[DST]).toBe(2000 + AMOUNT);
      expect(origFinal[SRC]).toBe(1000); // source unchanged
    });

    it('income with only destination', () => {
      const original = originalBalanceUpdates('income', AMOUNT, null, null, DST);
      const refactored = refactoredBalanceUpdates('income', AMOUNT, null, null, DST);
      expect(applyUpdates({}, original)).toEqual(applyUpdates({}, refactored));
    });

    it('income with only source (no destination → no impact)', () => {
      const original = originalBalanceUpdates('income', AMOUNT, null, SRC, null);
      const refactored = refactoredBalanceUpdates('income', AMOUNT, null, SRC, null);

      // Original: pushes nothing because no destination
      // Refactored: pushes nothing because no destination
      // FINAL STATE: no change to any account
      const origFinal = applyUpdates({ [SRC]: 500 }, original);
      const refactFinal = applyUpdates({ [SRC]: 500 }, refactored);
      expect(refactFinal).toEqual(origFinal);
    });
  });

  describe('Expense', () => {
    it('expense with source+destination: only source gets -amount', () => {
      const original = originalBalanceUpdates('expense', AMOUNT, null, SRC, DST);
      const refactored = refactoredBalanceUpdates('expense', AMOUNT, null, SRC, DST);

      const before = { [SRC]: 5000, [DST]: 2000 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);
      expect(refactFinal).toEqual(origFinal);
      expect(origFinal[SRC]).toBe(5000 - AMOUNT);
      expect(origFinal[DST]).toBe(2000); // destination unchanged
    });

    it('expense with only source', () => {
      const original = originalBalanceUpdates('expense', AMOUNT, null, SRC, null);
      const refactored = refactoredBalanceUpdates('expense', AMOUNT, null, SRC, null);
      expect(applyUpdates({ [SRC]: 1000 }, original)).toEqual(
        applyUpdates({ [SRC]: 1000 }, refactored)
      );
    });
  });

  describe('Transfer', () => {
    it('transfer with source+destination: both accounts updated', () => {
      const original = originalBalanceUpdates('transfer', AMOUNT, null, SRC, DST);
      const refactored = refactoredBalanceUpdates('transfer', AMOUNT, null, SRC, DST);

      const before = { [SRC]: 5000, [DST]: 1000 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);

      expect(refactFinal).toEqual(origFinal);
      expect(origFinal[SRC]).toBe(5000 - AMOUNT); // source decreased
      expect(origFinal[DST]).toBe(1000 + AMOUNT); // destination increased
    });

    it('transfer with only source', () => {
      const original = originalBalanceUpdates('transfer', AMOUNT, null, SRC, null);
      const refactored = refactoredBalanceUpdates('transfer', AMOUNT, null, SRC, null);
      expect(applyUpdates({ [SRC]: 1000 }, original)).toEqual(
        applyUpdates({ [SRC]: 1000 }, refactored)
      );
    });

    it('transfer with only destination', () => {
      const original = originalBalanceUpdates('transfer', AMOUNT, null, null, DST);
      const refactored = refactoredBalanceUpdates('transfer', AMOUNT, null, null, DST);
      expect(applyUpdates({ [DST]: 1000 }, original)).toEqual(
        applyUpdates({ [DST]: 1000 }, refactored)
      );
    });
  });

  describe('Adjustment', () => {
    it('adjustment increase: source gets +amount', () => {
      const original = originalBalanceUpdates('adjustment', AMOUNT, 'increase', SRC, null);
      const refactored = refactoredBalanceUpdates('adjustment', AMOUNT, 'increase', SRC, null);

      const before = { [SRC]: 1000 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);
      expect(refactFinal).toEqual(origFinal);
      expect(origFinal[SRC]).toBe(1000 + AMOUNT);
    });

    it('adjustment decrease: source gets -amount', () => {
      const original = originalBalanceUpdates('adjustment', AMOUNT, 'decrease', SRC, null);
      const refactored = refactoredBalanceUpdates('adjustment', AMOUNT, 'decrease', SRC, null);

      const before = { [SRC]: 1000 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);
      expect(refactFinal).toEqual(origFinal);
      expect(origFinal[SRC]).toBe(1000 - AMOUNT);
    });

    it('adjustment null direction (defaults to decrease)', () => {
      const original = originalBalanceUpdates('adjustment', AMOUNT, null, SRC, null);
      const refactored = refactoredBalanceUpdates('adjustment', AMOUNT, null, SRC, null);

      const before = { [SRC]: 1000 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);
      expect(refactFinal).toEqual(origFinal);
      expect(origFinal[SRC]).toBe(1000 - AMOUNT);
    });
  });

  describe('Edge cases', () => {
    it('zero amount income: no balance change in both', () => {
      const original = originalBalanceUpdates('income', 0, null, null, DST);
      const refactored = refactoredBalanceUpdates('income', 0, null, null, DST);

      const before = { [DST]: 500 };
      const origFinal = applyUpdates(before, original);
      const refactFinal = applyUpdates(before, refactored);

      // Both should result in identical final state
      expect(refactFinal).toEqual(origFinal);
      // And DST should be unchanged
      expect(origFinal[DST]).toBe(500);
    });

    it('large amount (100M): preserved exactly', () => {
      const big = 100_000_000;
      const original = originalBalanceUpdates('income', big, null, null, DST);
      const refactored = refactoredBalanceUpdates('income', big, null, null, DST);
      expect(applyUpdates({ [DST]: 0 }, original)).toEqual(
        applyUpdates({ [DST]: 0 }, refactored)
      );
      expect(applyUpdates({ [DST]: 0 }, original)[DST]).toBe(big);
    });

    it('decimal amount: preserved exactly', () => {
      const dec = 1234.56;
      const original = originalBalanceUpdates('expense', dec, null, SRC, null);
      const refactored = refactoredBalanceUpdates('expense', dec, null, SRC, null);
      expect(applyUpdates({ [SRC]: 10000 }, original)).toEqual(
        applyUpdates({ [SRC]: 10000 }, refactored)
      );
      expect(applyUpdates({ [SRC]: 10000 }, original)[SRC]).toBe(10000 - dec);
    });
  });
});

// ============================================================================
// Exhaustive: All combinations must produce identical FINAL BALANCE
// ============================================================================

describe('Exhaustive parity: all type × account combinations', () => {
  const types = ['income', 'expense', 'transfer', 'adjustment'] as const;
  const directions = ['increase', 'decrease', null, undefined] as const;
  const accountSets = [
    { src: null, dst: null },
    { src: 'src', dst: null },
    { src: null, dst: 'dst' },
    { src: 'src', dst: 'dst' },
  ];
  const amounts = [0, 1, 100, 1000, -500, 12345.67];

  for (const type of types) {
    for (const dir of directions) {
      for (const acc of accountSets) {
        for (const amount of amounts) {
          it(`${type} dir=${String(dir)} accounts=${JSON.stringify(acc)} amount=${amount}`, () => {
            const original = originalBalanceUpdates(
              type, amount, dir, acc.src, acc.dst
            );
            const refactored = refactoredBalanceUpdates(
              type, amount, dir, acc.src, acc.dst
            );

            // Check FINAL BALANCE state (not statement count)
            const before: Record<string, number> = { src: 10000, dst: 5000 };
            const origFinal = applyUpdates(before, original);
            const refactFinal = applyUpdates(before, refactored);

            expect(refactFinal).toEqual(origFinal);
          });
        }
      }
    }
  }
});
