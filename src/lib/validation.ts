import { z } from 'zod';

const requiredName = z.string().trim().min(1, 'กรุณาระบุชื่อ').max(120, 'ชื่อต้องไม่เกิน 120 ตัวอักษร');

export const personInputSchema = z.object({
  name: requiredName,
  isDaughter: z.boolean().default(false),
});

export const propertyInputSchema = z.object({
  name: requiredName,
  ownerPersonId: z.string().trim().min(1, 'กรุณาเลือกเจ้าของ'),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const accountInputSchema = z.object({
  name: requiredName,
  personId: z.string().trim().min(1, 'กรุณาเลือกบุคคล'),
  propertyId: z.string().trim().min(1).nullable().optional(),
  accountType: z.enum(['bank', 'cash']),
  openingBalance: z.number().finite().default(0),
  currentBalance: z.number().finite().default(0),
});

export const transactionInputSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.number().finite().positive('จำนวนเงินต้องมากกว่า 0'),
    date: z.coerce.date(),
    title: requiredName,
    ownerPersonId: z.string().trim().min(1, 'กรุณาเลือกผู้รับผิดชอบ'),
    payerPersonId: z.string().trim().min(1, 'กรุณาเลือกผู้จ่าย/แหล่งเงิน'),
    propertyId: z.string().trim().min(1).nullable().optional(),
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
  });

export function validationError(error: z.ZodError) {
  return {
    error: 'ข้อมูลไม่ถูกต้อง',
    fields: error.flatten().fieldErrors,
  };
}