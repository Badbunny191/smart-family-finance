import { z } from 'zod';

const requiredName = z.string().trim().min(1, 'กรุณาระบุชื่อ').max(120, 'ชื่อต้องไม่เกิน 120 ตัวอักษร');

export const personInputSchema = z.object({
  name: requiredName,
  relationship: z.enum(['father', 'mother', 'son', 'daughter', 'other']).nullable().optional(),
});

export const propertyInputSchema = z.object({
  name: requiredName,
  ownerPersonId: z.string().trim().min(1, 'กรุณาเลือกเจ้าของ'),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const accountInputSchema = z.object({
  name: requiredName,
  accountAlias: z.string().trim().max(120, 'ชื่อเรียกต้องไม่เกิน 120 ตัวอักษร').nullable().optional(),
  bankName: z.string().trim().max(120, 'ชื่อธนาคารต้องไม่เกิน 120 ตัวอักษร').nullable().optional(),
  accountNumber: z.string().trim().max(50, 'เลขบัญชีต้องไม่เกิน 50 ตัวอักษร').nullable().optional(),
  personId: z.string().trim().min(1, 'กรุณาเลือกบุคคล'),
  propertyId: z.string().trim().min(1).nullable().optional(),
  accountType: z.enum(['bank', 'cash']),
  isBusinessAccount: z.boolean().default(false),
  openingBalance: z.number().finite().default(0),
  currentBalance: z.number().finite().default(0),
});

export const categoryInputSchema = z.object({
  name: requiredName,
  type: z.enum(['income', 'expense']),
  icon: z.string().trim().max(50).nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const transactionStatusInputSchema = z.object({
  name: requiredName,
  slug: z.string().trim().min(1, 'กรุณาระบุรหัสสถานะ').max(60, 'รหัสสถานะต้องไม่เกิน 60 ตัวอักษร'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const transactionInputSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.number().finite().positive('จำนวนเงินต้องมากกว่า 0'),
    date: z.coerce.date(),
    title: requiredName,
    propertyId: z.string().trim().min(1).nullable().optional(),
    categoryId: z.string().trim().min(1).nullable().optional(),
    businessStatus: z
      .enum(['pending', 'received'])
      .nullable()
      .optional(),
    sourceAccountId: z.string().trim().min(1).nullable().optional(),
    destinationAccountId: z.string().trim().min(1).nullable().optional(),
    note: z.string().trim().max(500, 'หมายเหตุต้องไม่เกิน 500 ตัวอักษร').nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.type === 'income' && !value.destinationAccountId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationAccountId'], message: 'รายรับต้องมีบัญชีปลายทาง' });
    }
    if (value.type === 'expense' && !value.sourceAccountId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceAccountId'], message: 'รายจ่ายต้องมีบัญชีต้นทาง' });
    }
    if (value.type === 'transfer' && (!value.sourceAccountId || !value.destinationAccountId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceAccountId'], message: 'รายการโอนต้องมีบัญชีต้นทางและปลายทาง' });
    }
    if (value.sourceAccountId && value.sourceAccountId === value.destinationAccountId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationAccountId'], message: 'บัญชีต้นทางและปลายทางต้องต่างกัน' });
    }
    if (value.type === 'transfer' && value.categoryId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: 'รายการโอนไม่ใช้หมวดหมู่รายรับหรือรายจ่าย' });
    }
  });

export const transactionMetadataSchema = z.object({
  categoryId: z.string().trim().min(1).nullable().optional(),
  businessStatus: z
    .enum(['pending', 'received'])
    .nullable()
    .optional(),
});

export function validationError(error: z.ZodError) {
  return {
    error: 'ข้อมูลไม่ถูกต้อง',
    fields: error.flatten().fieldErrors,
  };
}