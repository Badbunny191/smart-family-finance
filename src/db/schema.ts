import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 1. USERS
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    role: text('role', { enum: ['admin', 'viewer'] }).notNull().default('viewer'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    deletedIdx: index('users_deleted_idx').on(table.deletedAt),
  })
);

export const sessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    userIdx: index('sessions_user_idx').on(table.userId),
  })
);

export const accountsAuth = sqliteTable(
  'auth_accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    password: text('password'),
  },
  (table) => ({
    userIdx: index('accounts_auth_user_idx').on(table.userId),
  })
);

export const verifications = sqliteTable(
  'auth_verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    identifierIdx: index('verifications_identifier_idx').on(table.identifier),
  })
);

// 2. PERSONS
export const persons = sqliteTable(
  'persons',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    isDaughter: integer('is_daughter', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    deletedIdx: index('persons_deleted_idx').on(table.deletedAt),
  })
);

// 3. PROPERTIES (Zero Balance Stored)
export const properties = sqliteTable(
  'properties',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerPersonId: text('owner_person_id')
      .notNull()
      .references(() => persons.id),
    status: text('status', { enum: ['active', 'inactive'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    ownerIdx: index('properties_owner_idx').on(table.ownerPersonId),
    deletedIdx: index('properties_deleted_idx').on(table.deletedAt),
  })
);

// 4. ACCOUNTS (Source of Truth for Balances)
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    accountAlias: text('account_alias'),
    bankName: text('bank_name'),
    accountNumber: text('account_number'),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id),
    propertyId: text('property_id').references(() => properties.id),
    accountType: text('account_type', { enum: ['bank', 'cash'] }).notNull(),
    openingBalance: real('opening_balance').notNull().default(0),
    currentBalance: real('current_balance').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    personIdx: index('accounts_person_idx').on(table.personId),
    propertyIdx: index('accounts_property_idx').on(table.propertyId),
    deletedIdx: index('accounts_deleted_idx').on(table.deletedAt),
  })
);

// 5. CATEGORIES (With Visual Metadata)
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type', { enum: ['income', 'expense'] }).notNull(),
    icon: text('icon'),
    color: text('color'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    deletedIdx: index('categories_deleted_idx').on(table.deletedAt),
  })
);

export const transactionStatuses = sqliteTable(
  'transaction_statuses',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    deletedIdx: index('transaction_statuses_deleted_idx').on(table.deletedAt),
  })
);

// 6. TRANSACTIONS
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
    amount: real('amount').notNull(),
    date: integer('date', { mode: 'timestamp' }).notNull(),
    title: text('title').notNull(),
    propertyId: text('property_id').references(() => properties.id),
    categoryId: text('category_id').references(() => categories.id),
    sourceAccountId: text('source_account_id').references(() => accounts.id),
    destinationAccountId: text('destination_account_id').references(() => accounts.id),
    status: text('status', { enum: ['pending', 'completed', 'cancelled'] })
      .notNull()
      .default('completed'),
    businessStatus: text('business_status', {
      enum: [
        'pending_payment',
        'customer_paid',
        'awaiting_business_transfer',
        'business_received',
        'closed',
      ],
    }),
    note: text('note'),
    ownerPersonId: text('owner_person_id').references(() => persons.id),
    payerPersonId: text('payer_person_id').references(() => persons.id),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    recurringScheduleId: text('recurring_schedule_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    dateIdx: index('transactions_date_idx').on(table.date),
    supportQueryIdx: index('transactions_support_idx').on(
      table.type,
      table.status,
      table.deletedAt
    ),
    propertyIdx: index('transactions_property_idx').on(table.propertyId),
    businessStatusIdx: index('transactions_business_status_idx').on(table.businessStatus),
    deletedIdx: index('transactions_deleted_idx').on(table.deletedAt),
  })
);

// 7. ATTACHMENTS
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    fileSize: integer('file_size').notNull(),
    width: integer('width'),
    height: integer('height'),
    uploadedByUserId: text('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    transactionIdx: index('attachments_transaction_idx').on(table.transactionId),
    deletedIdx: index('attachments_deleted_idx').on(table.deletedAt),
  })
);

// 8. ACTIVITY LOGS
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action', { enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'] }).notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    entityIdx: index('logs_entity_idx').on(table.entity, table.entityId),
  })
);

// 9. RECURRING SCHEDULES (Dormant V2 Table)
export const recurringSchedules = sqliteTable('recurring_schedules', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  nextRunDate: integer('next_run_date', { mode: 'timestamp' }).notNull(),
  ownerPersonId: text('owner_person_id')
    .notNull()
    .references(() => persons.id),
  payerPersonId: text('payer_person_id')
    .notNull()
    .references(() => persons.id),
  categoryId: text('category_id').references(() => categories.id),
  status: text('status', { enum: ['active', 'paused', 'terminated'] })
    .notNull()
    .default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// 10. BUDGETS (Dormant V2 Table)
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  propertyId: text('property_id').references(() => properties.id),
  amount: real('amount').notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// 11. OCR RESULTS (Dormant V2 Table)
export const ocrResults = sqliteTable('ocr_results', {
  id: text('id').primaryKey(),
  attachmentId: text('attachment_id')
    .notNull()
    .references(() => attachments.id),
  rawPayload: text('raw_payload').notNull(),
  detectedAmount: real('detected_amount'),
  detectedDate: integer('detected_date', { mode: 'timestamp' }),
  confidenceScore: real('confidence_score'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// 12. LINE ACCOUNTS (Dormant V2 Table)
export const lineAccounts = sqliteTable('line_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  lineUserId: text('line_user_id').notNull().unique(),
  displayName: text('display_name'),
  pictureUrl: text('picture_url'),
  notifyEnabled: integer('notify_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// --- DRIZZLE RELATIONS ---

export const usersRelations = relations(users, ({ many, one }) => ({
  activityLogs: many(activityLogs),
  lineAccount: one(lineAccounts, { fields: [users.id], references: [lineAccounts.userId] }),
}));

export const personsRelations = relations(persons, ({ many }) => ({
  properties: many(properties),
  accounts: many(accounts),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(persons, { fields: [properties.ownerPersonId], references: [persons.id] }),
  accounts: many(accounts),
  transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  person: one(persons, { fields: [accounts.personId], references: [persons.id] }),
  property: one(properties, { fields: [accounts.propertyId], references: [properties.id] }),
  sourceTransactions: many(transactions, { relationName: 'sourceAccountTransactions' }),
  destinationTransactions: many(transactions, { relationName: 'destinationAccountTransactions' }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionStatusesRelations = relations(transactionStatuses, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  property: one(properties, { fields: [transactions.propertyId], references: [properties.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  sourceAccount: one(accounts, {
    fields: [transactions.sourceAccountId],
    references: [accounts.id],
    relationName: 'sourceAccountTransactions',
  }),
  destinationAccount: one(accounts, {
    fields: [transactions.destinationAccountId],
    references: [accounts.id],
    relationName: 'destinationAccountTransactions',
  }),
  attachments: many(attachments),
  createdByUser: one(users, { fields: [transactions.createdByUserId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  transaction: one(transactions, { fields: [attachments.transactionId], references: [transactions.id] }),
  uploadedByUser: one(users, { fields: [attachments.uploadedByUserId], references: [users.id] }),
  ocrResult: one(ocrResults, { fields: [attachments.id], references: [ocrResults.attachmentId] }),
}));