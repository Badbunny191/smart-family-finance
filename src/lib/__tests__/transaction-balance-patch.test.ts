/**
 * Unit Tests for PATCH Transaction Balance Reconciliation
 *
 * Tests the PATCH endpoint logic for updating transactions:
 * - Fetch old transaction state
 * - Apply update
 * - Calculate oldImpact = getBalanceImpact(oldTx)
 * - Calculate newImpact = getBalanceImpact(updatedTx)
 * - delta = newImpact - oldImpact
 * - Apply balance delta
 *
 * Scenarios:
 * 1. income pending → received   → +amount (balance increases)
 * 2. income received → pending   → -amount (balance decreases)
 * 3. income received → received  → 0       (no change)
 * 4. income pending → pending    → 0       (no change)
 */

import {
  getBalanceImpact,
  getTransferImpact,
  type TransactionForBalance,
} from '@/lib/transaction-balance';

// ============================================================================
// Helper: Replicates PATCH balance reconciliation logic
// ============================================================================

function computePatchDelta(
  oldTx: TransactionForBalance,
  newBusinessStatus: 'pending' | 'received' | null | undefined
): { accountId: string | null; delta: number }[] {
  // undefined = no change requested (PATCH didn't pass businessStatus)
  if (newBusinessStatus === undefined) {
    return [{ accountId: null, delta: 0 }];
  }

  const newStatus = newBusinessStatus === 'pending' ? 'pending' : 'completed';
  const newTx: TransactionForBalance = {
    ...oldTx,
    status: newStatus,
  };

  const results: { accountId: string | null; delta: number }[] = [];

  if (oldTx.type === 'transfer') {
    // Raw impacts (forward, not reverse)
    const oldImpactSource = getTransferImpact(oldTx, oldTx.sourceAccountId);
    const oldImpactDest = getTransferImpact(oldTx, oldTx.destinationAccountId);
    const newImpactSource = getTransferImpact(newTx, oldTx.sourceAccountId);
    const newImpactDest = getTransferImpact(newTx, oldTx.destinationAccountId);

    // delta = newImpact - oldImpact
    const sourceDelta = newImpactSource - oldImpactSource;
    const destDelta = newImpactDest - oldImpactDest;

    results.push({ accountId: oldTx.sourceAccountId ?? null, delta: sourceDelta });
    results.push({ accountId: oldTx.destinationAccountId ?? null, delta: destDelta });
  } else {
    const oldImpact = getBalanceImpact(oldTx);
    const newImpact = getBalanceImpact(newTx);
    const delta = newImpact - oldImpact;
    const targetAccountId = oldTx.type === 'income' ? oldTx.destinationAccountId : oldTx.sourceAccountId;
    results.push({ accountId: targetAccountId ?? null, delta });
  }

  return results;
}

// ============================================================================
// Requirement: income pending ↔ received reconciliation
// ============================================================================

describe('PATCH balance reconciliation — Income', () => {
  const destAccountId = 'income-dest-123';
  const amount = 1000;

  describe('Case 1: income pending → received (balance increases by amount)', () => {
    it('should produce +amount delta on destination account', () => {
      const oldTx: TransactionForBalance = {
        type: 'income',
        amount,
        status: 'pending', // pending
        businessStatus: 'pending',
        destinationAccountId: destAccountId,
      };

      const deltas = computePatchDelta(oldTx, 'received');

      // income pending → 0 impact
      // income completed → +amount impact
      // delta = +1000 - 0 = +1000
      expect(deltas).toHaveLength(1);
      expect(deltas[0].accountId).toBe(destAccountId);
      expect(deltas[0].delta).toBe(amount);
    });

    it('should apply +amount to account (delta > 0)', () => {
      const oldTx: TransactionForBalance = {
        type: 'income',
        amount: 5000,
        status: 'pending',
        businessStatus: 'pending',
        destinationAccountId: destAccountId,
      };

      const deltas = computePatchDelta(oldTx, 'received');
      expect(deltas[0].delta).toBe(5000);
      expect(deltas[0].delta).toBeGreaterThan(0);
    });
  });

  describe('Case 2: income received → pending (balance decreases by amount)', () => {
    it('should produce -amount delta on destination account', () => {
      const oldTx: TransactionForBalance = {
        type: 'income',
        amount,
        status: 'completed', // received = completed
        businessStatus: 'received',
        destinationAccountId: destAccountId,
      };

      const deltas = computePatchDelta(oldTx, 'pending');

      // income completed → +amount impact
      // income pending → 0 impact
      // delta = 0 - 1000 = -1000
      expect(deltas).toHaveLength(1);
      expect(deltas[0].accountId).toBe(destAccountId);
      expect(deltas[0].delta).toBe(-amount);
    });

    it('should apply -amount to account (delta < 0)', () => {
      const oldTx: TransactionForBalance = {
        type: 'income',
        amount: 7500,
        status: 'completed',
        businessStatus: 'received',
        destinationAccountId: destAccountId,
      };

      const deltas = computePatchDelta(oldTx, 'pending');
      expect(deltas[0].delta).toBe(-7500);
      expect(deltas[0].delta).toBeLessThan(0);
    });
  });

  describe('Case 3: income received → received (no change)', () => {
    it('should produce 0 delta', () => {
      const oldTx: TransactionForBalance = {
        type: 'income',
        amount,
        status: 'completed',
        businessStatus: 'received',
        destinationAccountId: destAccountId,
      };

      const deltas = computePatchDelta(oldTx, 'received');

      // income completed → +amount
      // income completed → +amount
      // delta = 0
      expect(deltas[0].delta).toBe(0);
    });
  });

  describe('Case 4: income pending → pending (no change)', () => {
    it('should produce 0 delta', () => {
      const oldTx: TransactionForBalance = {
        type: 'income',
        amount,
        status: 'pending',
        businessStatus: 'pending',
        destinationAccountId: destAccountId,
      };

      const deltas = computePatchDelta(oldTx, 'pending');

      // income pending → 0
      // income pending → 0
      // delta = 0
      expect(deltas[0].delta).toBe(0);
    });
  });
});

// ============================================================================
// Expense tests
// ============================================================================

describe('PATCH balance reconciliation — Expense', () => {
  const sourceAccountId = 'expense-source-456';
  const amount = 500;

  it('expense pending → received: delta = -amount (subtract from source)', () => {
    const oldTx: TransactionForBalance = {
      type: 'expense',
      amount,
      status: 'pending',
      businessStatus: 'pending',
      sourceAccountId,
    };

    const deltas = computePatchDelta(oldTx, 'received');

    // expense pending → 0
    // expense completed → -amount
    // delta = -500 - 0 = -500
    expect(deltas[0].accountId).toBe(sourceAccountId);
    expect(deltas[0].delta).toBe(-amount);
  });

  it('expense received → pending: delta = +amount (add back to source)', () => {
    const oldTx: TransactionForBalance = {
      type: 'expense',
      amount,
      status: 'completed',
      businessStatus: 'received',
      sourceAccountId,
    };

    const deltas = computePatchDelta(oldTx, 'pending');

    // expense completed → -500
    // expense pending → 0
    // delta = 0 - (-500) = +500
    expect(deltas[0].delta).toBe(amount);
  });

  it('expense received → received: delta = 0', () => {
    const oldTx: TransactionForBalance = {
      type: 'expense',
      amount,
      status: 'completed',
      businessStatus: 'received',
      sourceAccountId,
    };

    const deltas = computePatchDelta(oldTx, 'received');
    expect(deltas[0].delta).toBe(0);
  });
});

// ============================================================================
// Transfer tests (per-account reconciliation)
// ============================================================================

describe('PATCH balance reconciliation — Transfer', () => {
  const srcId = 'transfer-src';
  const dstId = 'transfer-dst';
  const amount = 2000;

  it('transfer pending → received: source -amount, destination +amount', () => {
    const oldTx: TransactionForBalance = {
      type: 'transfer',
      amount,
      status: 'pending',
      businessStatus: 'pending',
      sourceAccountId: srcId,
      destinationAccountId: dstId,
    };

    const deltas = computePatchDelta(oldTx, 'received');

    // Source: old was 0 impact, new is -amount → delta = -amount
    const srcDelta = deltas.find((d) => d.accountId === srcId);
    expect(srcDelta?.delta).toBe(-amount);

    // Destination: old was 0 impact, new is +amount → delta = +amount
    const dstDelta = deltas.find((d) => d.accountId === dstId);
    expect(dstDelta?.delta).toBe(amount);
  });

  it('transfer received → pending: source +amount, destination -amount', () => {
    const oldTx: TransactionForBalance = {
      type: 'transfer',
      amount,
      status: 'completed',
      businessStatus: 'received',
      sourceAccountId: srcId,
      destinationAccountId: dstId,
    };

    const deltas = computePatchDelta(oldTx, 'pending');

    // Source: old was -amount, new is 0 → delta = 0 - (-amount) = +amount
    const srcDelta = deltas.find((d) => d.accountId === srcId);
    expect(srcDelta?.delta).toBe(amount);

    // Destination: old was +amount, new is 0 → delta = 0 - amount = -amount
    const dstDelta = deltas.find((d) => d.accountId === dstId);
    expect(dstDelta?.delta).toBe(-amount);
  });

  it('transfer received → received: both deltas = 0', () => {
    const oldTx: TransactionForBalance = {
      type: 'transfer',
      amount,
      status: 'completed',
      businessStatus: 'received',
      sourceAccountId: srcId,
      destinationAccountId: dstId,
    };

    const deltas = computePatchDelta(oldTx, 'received');
    expect(deltas.find((d) => d.accountId === srcId)?.delta).toBe(0);
    expect(deltas.find((d) => d.accountId === dstId)?.delta).toBe(0);
  });
});

// ============================================================================
// Adjustment tests
// ============================================================================

describe('PATCH balance reconciliation — Adjustment', () => {
  const accountId = 'adj-account';
  const amount = 300;

  it('adjustment increase pending → received: delta = +amount', () => {
    const oldTx: TransactionForBalance = {
      type: 'adjustment',
      amount,
      status: 'pending',
      businessStatus: 'pending',
      adjustmentDirection: 'increase',
      sourceAccountId: accountId,
    };

    const deltas = computePatchDelta(oldTx, 'received');
    expect(deltas[0].delta).toBe(amount);
  });

  it('adjustment decrease pending → received: delta = -amount', () => {
    const oldTx: TransactionForBalance = {
      type: 'adjustment',
      amount,
      status: 'pending',
      businessStatus: 'pending',
      adjustmentDirection: 'decrease',
      sourceAccountId: accountId,
    };

    const deltas = computePatchDelta(oldTx, 'received');
    expect(deltas[0].delta).toBe(-amount);
  });
});

// ============================================================================
// Idempotency / Edge cases
// ============================================================================

describe('PATCH balance reconciliation — Edge cases', () => {
  it('should produce 0 delta when businessStatus unchanged (e.g., only categoryId updated)', () => {
    const oldTx: TransactionForBalance = {
      type: 'income',
      amount: 1000,
      status: 'completed',
      businessStatus: 'received',
      destinationAccountId: 'dest',
    };

    // Pass same businessStatus → no effective change
    const deltas = computePatchDelta(oldTx, 'received');
    expect(deltas[0].delta).toBe(0);
  });

  it('should treat null businessStatus as "set to null" (becomes completed)', () => {
    // null = explicit clear → newStatus becomes 'completed' (per schema logic)
    // income pending → null = income pending → completed = +amount
    const oldTx: TransactionForBalance = {
      type: 'income',
      amount: 1000,
      status: 'pending',
      businessStatus: 'pending',
      destinationAccountId: 'dest',
    };

    const deltas = computePatchDelta(oldTx, null);
    // pending → completed: delta = +amount
    expect(deltas[0].delta).toBe(1000);
  });

  it('should treat undefined businessStatus as "no change"', () => {
    const oldTx: TransactionForBalance = {
      type: 'income',
      amount: 1000,
      status: 'pending',
      businessStatus: 'pending',
      destinationAccountId: 'dest',
    };

    // undefined = field not provided in PATCH → no change
    const deltas = computePatchDelta(oldTx, undefined);
    expect(deltas[0].delta).toBe(0);
  });

  it('should round-trip cleanly: pending → received → pending brings balance back', () => {
    const initialTx: TransactionForBalance = {
      type: 'income',
      amount: 1000,
      status: 'pending',
      businessStatus: 'pending',
      destinationAccountId: 'dest',
    };

    // Step 1: pending → received
    const step1 = computePatchDelta(initialTx, 'received');
    expect(step1[0].delta).toBe(1000);

    // Step 2: received → pending (apply reverse)
    const receivedTx: TransactionForBalance = { ...initialTx, status: 'completed', businessStatus: 'received' };
    const step2 = computePatchDelta(receivedTx, 'pending');
    expect(step2[0].delta).toBe(-1000);

    // Total delta = 0 (idempotent)
    expect(step1[0].delta + step2[0].delta).toBe(0);
  });
});
