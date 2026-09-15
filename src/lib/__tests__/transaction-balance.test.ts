/**
 * Unit Tests for Transaction Balance Impact Logic
 *
 * Tests the getReverseImpact and getTransferReverseImpact functions
 * against the correct balance rollback matrix:
 *
 * | type     | status     | Reverse Impact on Account      |
 * |----------|------------|-------------------------------|
 * | income   | pending    | 0 (never affected balance)     |
 * | income   | completed  | -amount (was +amount)           |
 * | expense  | completed  | +amount (was -amount)           |
 * | transfer | completed  | per account (see below)         |
 * | adjustment| increase  | -amount (was +amount)           |
 * | adjustment| decrease  | +amount (was -amount)           |
 *
 * Transfer reverse impact per account:
 * | Account   | Reverse Impact |
 * |-----------|----------------|
 * | source    | +amount         |
 * | destination| -amount        |
 */

import {
  getReverseImpact,
  getTransferReverseImpact,
  getBalanceImpact,
  type TransactionForBalance,
} from '@/lib/transaction-balance';

// ============================================================================
// Test Cases from Requirements
// ============================================================================

describe('Balance Rollback Matrix (Requirements)', () => {
  const destAccountId = 'dest-123';
  const sourceAccountId = 'src-456';

  describe('Case 1: income + pending → delete → balance unchanged', () => {
    it('should return 0 when deleting income with pending status', () => {
      const tx: TransactionForBalance = {
        type: 'income',
        amount: 1000,
        status: 'pending',
        destinationAccountId: destAccountId,
      };
      const reverse = getReverseImpact(tx, destAccountId);
      expect(reverse).toBe(0);
    });

    it('should return 0 regardless of accountId when pending', () => {
      const tx: TransactionForBalance = {
        type: 'income',
        amount: 5000,
        status: 'pending',
        destinationAccountId: destAccountId,
      };
      // Even wrong accountId should return 0 for pending
      expect(getReverseImpact(tx, 'wrong-account')).toBe(0);
      expect(getReverseImpact(tx, destAccountId)).toBe(0);
      expect(getReverseImpact(tx, null)).toBe(0);
    });
  });

  describe('Case 2: income + completed → delete → balance decreases by amount', () => {
    it('should return -amount when deleting completed income', () => {
      const tx: TransactionForBalance = {
        type: 'income',
        amount: 1000,
        status: 'completed',
        destinationAccountId: destAccountId,
      };
      const reverse = getReverseImpact(tx, destAccountId);
      expect(reverse).toBe(-1000);
    });

    it('should return 0 for wrong account (not destination)', () => {
      const tx: TransactionForBalance = {
        type: 'income',
        amount: 2500,
        status: 'completed',
        destinationAccountId: destAccountId,
      };
      // Source account should not be affected by income deletion
      expect(getReverseImpact(tx, sourceAccountId)).toBe(0);
    });
  });

  describe('Case 3: expense + completed → delete → balance increases by amount', () => {
    it('should return +amount when deleting completed expense', () => {
      const tx: TransactionForBalance = {
        type: 'expense',
        amount: 500,
        status: 'completed',
        sourceAccountId: sourceAccountId,
      };
      const reverse = getReverseImpact(tx, sourceAccountId);
      expect(reverse).toBe(500);
    });

    it('should return 0 for wrong account (not source)', () => {
      const tx: TransactionForBalance = {
        type: 'expense',
        amount: 300,
        status: 'completed',
        sourceAccountId: sourceAccountId,
      };
      // Destination account should not be affected by expense deletion
      expect(getReverseImpact(tx, destAccountId)).toBe(0);
    });
  });
});

// ============================================================================
// Transfer Tests
// ============================================================================

describe('Transfer Balance Rollback', () => {
  const srcAccountId = 'src-transfer';
  const dstAccountId = 'dst-transfer';

  describe('transfer + completed', () => {
    it('should add back to source account (reverse = +amount)', () => {
      const tx: TransactionForBalance = {
        type: 'transfer',
        amount: 1000,
        status: 'completed',
        sourceAccountId: srcAccountId,
        destinationAccountId: dstAccountId,
      };
      expect(getTransferReverseImpact(tx, srcAccountId)).toBe(1000);
    });

    it('should subtract from destination account (reverse = -amount)', () => {
      const tx: TransactionForBalance = {
        type: 'transfer',
        amount: 1000,
        status: 'completed',
        sourceAccountId: srcAccountId,
        destinationAccountId: dstAccountId,
      };
      expect(getTransferReverseImpact(tx, dstAccountId)).toBe(-1000);
    });
  });

  describe('transfer + pending', () => {
    it('should return 0 for both accounts', () => {
      const tx: TransactionForBalance = {
        type: 'transfer',
        amount: 2000,
        status: 'pending',
        sourceAccountId: srcAccountId,
        destinationAccountId: dstAccountId,
      };
      expect(getTransferReverseImpact(tx, srcAccountId)).toBe(0);
      expect(getTransferReverseImpact(tx, dstAccountId)).toBe(0);
    });
  });
});

// ============================================================================
// Adjustment Tests
// ============================================================================

describe('Adjustment Balance Rollback', () => {
  const accountId = 'adj-acct';

  describe('adjustment + increase (balance was +amount)', () => {
    it('should return -amount when deleting', () => {
      const tx: TransactionForBalance = {
        type: 'adjustment',
        amount: 500,
        status: 'completed',
        adjustmentDirection: 'increase',
        sourceAccountId: accountId,
      };
      expect(getReverseImpact(tx, accountId)).toBe(-500);
    });
  });

  describe('adjustment + decrease (balance was -amount)', () => {
    it('should return +amount when deleting', () => {
      const tx: TransactionForBalance = {
        type: 'adjustment',
        amount: 300,
        status: 'completed',
        adjustmentDirection: 'decrease',
        sourceAccountId: accountId,
      };
      expect(getReverseImpact(tx, accountId)).toBe(300);
    });
  });

  describe('adjustment + null direction (defaults to decrease)', () => {
    it('should return +amount (same as decrease)', () => {
      const tx: TransactionForBalance = {
        type: 'adjustment',
        amount: 150,
        status: 'completed',
        adjustmentDirection: null,
        sourceAccountId: accountId,
      };
      expect(getReverseImpact(tx, accountId)).toBe(150);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should return 0 for null accountId', () => {
    const tx: TransactionForBalance = {
      type: 'income',
      amount: 1000,
      status: 'completed',
      destinationAccountId: 'dest',
    };
    expect(getReverseImpact(tx, null)).toBe(0);
    expect(getReverseImpact(tx, undefined)).toBe(0);
  });

  it('should return 0 for cancelled status', () => {
    const tx: TransactionForBalance = {
      type: 'income',
      amount: 1000,
      status: 'cancelled',
      destinationAccountId: 'dest',
    };
    // Cancelled transactions also never affected balance
    expect(getReverseImpact(tx, 'dest')).toBe(0);
  });

  it('should handle unknown type gracefully', () => {
    const tx = {
      type: 'unknown' as any,
      amount: 1000,
      status: 'completed',
      destinationAccountId: 'dest',
    };
    expect(getReverseImpact(tx, 'dest')).toBe(0);
  });

  it('should handle zero amount', () => {
    const tx: TransactionForBalance = {
      type: 'income',
      amount: 0,
      status: 'completed',
      destinationAccountId: 'dest',
    };
    expect(getReverseImpact(tx, 'dest')).toBe(0);
  });
});

// ============================================================================
// Balance Impact (Create) - Sanity Check
// ============================================================================

describe('Balance Impact (for completeness)', () => {
  describe('income', () => {
    it('should return +amount for completed income', () => {
      const tx: TransactionForBalance = {
        type: 'income',
        amount: 1000,
        status: 'completed',
      };
      expect(getBalanceImpact(tx)).toBe(1000);
    });

    it('should return 0 for pending income', () => {
      const tx: TransactionForBalance = {
        type: 'income',
        amount: 1000,
        status: 'pending',
      };
      expect(getBalanceImpact(tx)).toBe(0);
    });
  });

  describe('expense', () => {
    it('should return -amount for completed expense', () => {
      const tx: TransactionForBalance = {
        type: 'expense',
        amount: 500,
        status: 'completed',
      };
      expect(getBalanceImpact(tx)).toBe(-500);
    });
  });

  describe('adjustment', () => {
    it('should return +amount for increase direction', () => {
      const tx: TransactionForBalance = {
        type: 'adjustment',
        amount: 200,
        status: 'completed',
        adjustmentDirection: 'increase',
      };
      expect(getBalanceImpact(tx)).toBe(200);
    });

    it('should return -amount for decrease direction', () => {
      const tx: TransactionForBalance = {
        type: 'adjustment',
        amount: 200,
        status: 'completed',
        adjustmentDirection: 'decrease',
      };
      expect(getBalanceImpact(tx)).toBe(-200);
    });
  });
});
