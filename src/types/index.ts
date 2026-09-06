import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  users,
  persons,
  properties,
  accounts,
  categories,
  transactions,
  attachments,
  activityLogs,
} from '@/db/schema';

export type UserRole = 'admin' | 'viewer';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';
export type AccountType = 'bank' | 'cash';
export type PropertyStatus = 'active' | 'inactive';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Person = InferSelectModel<typeof persons>;
export type NewPerson = InferInsertModel<typeof persons>;

export type Property = InferSelectModel<typeof properties>;
export type NewProperty = InferInsertModel<typeof properties>;

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;

export type Attachment = InferSelectModel<typeof attachments>;
export type NewAttachment = InferInsertModel<typeof attachments>;

export type ActivityLog = InferSelectModel<typeof activityLogs>;
export type NewActivityLog = InferInsertModel<typeof activityLogs>;

export interface DashboardResponse {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpense: number;
  daughterSupport: number;
  properties: {
    id: string;
    name: string;
    ownerName: string;
    calculatedBalance: number;
    status: PropertyStatus;
  }[];
}