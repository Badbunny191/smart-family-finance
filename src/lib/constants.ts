/**
 * Transaction type constants
 */
export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment',
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

/**
 * Transaction status constants
 */
export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUSES[keyof typeof TRANSACTION_STATUSES];

/**
 * Business status constants
 */
export const BUSINESS_STATUSES = {
  PENDING: 'pending',
  RECEIVED: 'received',
} as const;

export type BusinessStatus = typeof BUSINESS_STATUSES[keyof typeof BUSINESS_STATUSES];

/**
 * Adjustment direction constants
 */
export const ADJUSTMENT_DIRECTIONS = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
} as const;

export type AdjustmentDirection = typeof ADJUSTMENT_DIRECTIONS[keyof typeof ADJUSTMENT_DIRECTIONS];
