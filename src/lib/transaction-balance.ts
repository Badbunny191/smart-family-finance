/**
 * Transaction Balance Impact Utilities
 *
 * Centralized helpers for computing balance impact (how a transaction affects account balance)
 * and reverse impact (how deleting a transaction should reverse its effect).
 *
 * IMPORTANT: Balance is only affected when status !== 'pending'.
 * - income + completed: +amount to destination account
 * - expense + completed: -amount from source account
 * - transfer + completed: -amount from source, +amount to destination
 * - adjustment: depends on adjustmentDirection
 * - income/expense/transfer + pending: NO balance impact
 */

export interface TransactionForBalance {
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  status?: string | null; // 'pending' | 'completed' | 'cancelled'
  adjustmentDirection?: 'increase' | 'decrease' | null;
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
}

/**
 * Returns the balance change amount when a transaction is created.
 * - income + completed: +amount
 * - expense + completed: -amount
 * - transfer + completed: 0 (handles both accounts separately)
 * - adjustment + completed: +amount (increase) or -amount (decrease)
 * - ANY type + pending: 0
 *
 * For income: impact on destination account
 * For expense: impact on source account (negative)
 * For transfer: handled separately (source - amount, destination + amount)
 * For adjustment: impact on source account based on direction
 */
export function getBalanceImpact(tx: TransactionForBalance): number {
  if (tx.status === 'pending') {
    return 0;
  }
  switch (tx.type) {
    case 'income':
      return tx.amount;
    case 'expense':
      return -tx.amount;
    case 'adjustment':
      if (tx.adjustmentDirection === 'increase') {
        return tx.amount;
      }
      return -tx.amount;
    case 'transfer':
      // Transfer doesn't return a single scalar; caller must handle source + destination separately
      return 0;
    default:
      return 0;
  }
}

/**
 * Returns the balance delta to apply to an account when DELETING a transaction.
 * This is the NEGATION of what the transaction did when it was created.
 *
 * Matrix:
 * - income + pending  => 0       (never affected balance)
 * - income + completed => -amount (was +amount to destination, so reverse is -amount to destination)
 * - expense + completed => +amount (was -amount from source, so reverse is +amount to source)
 * - transfer + completed => handled separately per account (see getTransferReverseImpact)
 * - adjustment + increase => -amount (was +amount, so reverse is -amount)
 * - adjustment + decrease => +amount (was -amount, so reverse is +amount)
 *
 * @param tx - The transaction being deleted
 * @param accountId - The account ID to compute the reverse impact for
 * @returns The delta to ADD to account.currentBalance (negative = subtract)
 */
export function getReverseImpact(tx: TransactionForBalance, accountId: string | null | undefined): number {
  // No account specified → no impact
  if (!accountId) return 0;

  // Pending or cancelled transactions never affected balance → no reverse needed
  if (tx.status === 'pending' || tx.status === 'cancelled') return 0;

  // Zero amount → no impact
  if (Math.abs(tx.amount) < 1e-9) return 0;

  switch (tx.type) {
    case 'income':
      // Only destination account was affected. If called with wrong account → 0.
      if (accountId !== tx.destinationAccountId) return 0;
      return -tx.amount;

    case 'expense':
      // Only source account was affected. If called with wrong account → 0.
      if (accountId !== tx.sourceAccountId) return 0;
      return tx.amount;

    case 'transfer':
      // Caller must use getTransferReverseImpact for transfers
      return 0;

    case 'adjustment':
      return tx.adjustmentDirection === 'increase' ? -tx.amount : tx.amount;

    default:
      return 0;
  }
}

/**
 * Returns the reverse impact for a TRANSFER transaction.
 * Must be called TWICE: once for source, once for destination.
 *
 * @param tx - The transfer transaction being deleted
 * @param accountId - Which account to compute the impact for
 * @returns delta to ADD to account.currentBalance
 */
export function getTransferReverseImpact(tx: TransactionForBalance, accountId: string | null | undefined): number {
  if (!accountId) return 0;
  if (tx.status === 'pending') return 0;

  if (accountId === tx.sourceAccountId) {
    // Source account: was subtracted, so add back (+)
    return tx.amount;
  }
  if (accountId === tx.destinationAccountId) {
    // Destination account: was added, so subtract back (-)
    return -tx.amount;
  }
  return 0;
}

/**
 * Returns the RAW (forward) impact of a TRANSFER transaction on a specific account.
 * This is what the transaction did when it was created (not reversed).
 *
 * Matrix:
 * - transfer + pending   => 0
 * - transfer + completed => source: -amount, destination: +amount
 *
 * Use this for PATCH reconciliation (delta = newImpact - oldImpact).
 */
export function getTransferImpact(tx: TransactionForBalance, accountId: string | null | undefined): number {
  if (!accountId) return 0;
  if (tx.status === 'pending') return 0;
  if (Math.abs(tx.amount) < 1e-9) return 0;

  if (accountId === tx.sourceAccountId) {
    return -tx.amount; // Source was subtracted
  }
  if (accountId === tx.destinationAccountId) {
    return tx.amount; // Destination was added
  }
  return 0;
}
