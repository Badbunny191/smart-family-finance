#!/usr/bin/env node
/**
 * Generate 2,000 test transactions for performance validation
 * Usage: node scripts/generate-test-data.js
 */

const ACCOUNT_IDS = {
  kbank: 'acc_thanet_kbank',
  cash: 'acc_thanet_cash',
  savings: 'acc_thanet_savings',
  scb: 'acc_kangamon_scb',
  cashKangamon: 'acc_kangamon_cash',
};

const CATEGORY_IDS = {
  food: 'cat_food',
  transport: 'cat_transport',
  utilities: 'cat_utilities',
  shopping: 'cat_shopping',
  entertainment: 'cat_entertainment',
  medical: 'cat_medical',
  otherExpense: 'cat_other_expense',
  salary: 'cat_salary',
  otherIncome: 'cat_other_income',
  bonus: 'cat_bonus',
};

// Generate random number in range
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate UUID v4
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Convert date to Unix timestamp (milliseconds)
function dateToTimestamp(dateStr) {
  return new Date(dateStr).getTime();
}

// Get random date in range
function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString();
}

// Titles by category
const titles = {
  food: ['ซื้ออาหารกลางวัน', 'ตลาดนัดสวนจตุจักร', 'สั่ง GrabFood', 'ซื้อของในครัว', 'อาหารสำเร็จรูป'],
  transport: ['ค่าน้ำมันรถยนต์', 'ค่ารถไฟฟ้า BTS', 'ค่าแท็กซี่', 'ค่าวินมอเตอร์ไซค์'],
  utilities: ['ค่าไฟฟ้า กฟน.', 'ค่าน้ำประปา', 'ค่าอินเทอร์เน็ต AIS', 'ค่าประปานครวง'],
  shopping: ['ซื้อเสื้อผ้า', 'ซื้อรองเท้า', 'หยิบเติมบ้าน', 'ซื้อของใช้จำเป็น'],
  entertainment: ['ดูหนังในโรง', 'ค่า Netflix', 'เกมส์ออนไลน์', 'ค่า Spotify'],
  medical: ['ซื้อยาที่ร้านขายยา', 'ค่าพบแพทย์', 'ซื้อวิตามิน'],
  otherExpense: ['ค่าบริการต่างๆ', 'บริจาคเงิน', 'ค่าธรรมเนียม'],
  salary: ['เงินเดือนประจำเดือน'],
  otherIncome: ['รายได้เพิ่มจากงานพิเศษ', 'ขายของมือสอง', 'ดอกเบี้ย', 'เงินรางวัล'],
  bonus: ['โบนัสปลายปี', 'โบนัสผลงาน'],
};

// Date range: 180 days ago to today
const endDate = new Date('2026-09-18T23:59:59');
const startDate = new Date('2026-03-22T00:00:00');

// Distribution plan
const distribution = [
  // Expense (70% = 1400)
  { type: 'expense', category: 'food', count: 400, amountMin: 50, amountMax: 500 },
  { type: 'expense', category: 'transport', count: 300, amountMin: 100, amountMax: 1000 },
  { type: 'expense', category: 'utilities', count: 200, amountMin: 300, amountMax: 5000 },
  { type: 'expense', category: 'shopping', count: 200, amountMin: 200, amountMax: 3000 },
  { type: 'expense', category: 'entertainment', count: 160, amountMin: 100, amountMax: 2000 },
  { type: 'expense', category: 'medical', count: 100, amountMin: 100, amountMax: 3000 },
  { type: 'expense', category: 'otherExpense', count: 40, amountMin: 50, amountMax: 2000 },
  // Income (20% = 400)
  { type: 'income', category: 'salary', count: 240, amountMin: 15000, amountMax: 50000 },
  { type: 'income', category: 'otherIncome', count: 100, amountMin: 500, amountMax: 10000 },
  { type: 'income', category: 'bonus', count: 60, amountMin: 5000, amountMax: 30000 },
  // Transfer (10% = 200)
  { type: 'transfer', category: null, count: 200, amountMin: 500, amountMax: 10000 },
];

// Generate SQL INSERT statements
function generateSQL() {
  const sqlStatements = [];
  let totalCount = 0;

  for (const item of distribution) {
    for (let i = 0; i < item.count; i++) {
      totalCount++;
      const id = uuid();
      const amount = random(item.amountMin, item.amountMax);
      const dateStr = randomDate(startDate, endDate);
      const dateTimestamp = dateToTimestamp(dateStr);
      const createdAtTimestamp = dateToTimestamp(dateStr);
      const updatedAtTimestamp = dateToTimestamp(dateStr);
      const title = titles[item.category]?.[random(0, titles[item.category].length - 1)] || 'ธุรกรรม';
      const categoryId = item.category ? CATEGORY_IDS[item.category] : null;
      const note = `[PERF-TEST] ${item.type === 'expense' ? 'รายจ่าย' : item.type === 'income' ? 'รายรับ' : 'โอนเงิน'} - ${title} #${totalCount}`;

      let sourceAccountId = null;
      let destinationAccountId = null;

      if (item.type === 'expense') {
        sourceAccountId = Math.random() > 0.3 ? ACCOUNT_IDS.kbank : ACCOUNT_IDS.cash;
        destinationAccountId = null;
      } else if (item.type === 'income') {
        sourceAccountId = null;
        destinationAccountId = Math.random() > 0.3 ? ACCOUNT_IDS.kbank : ACCOUNT_IDS.savings;
      } else {
        // Transfer: randomly pick source and destination
        const accounts = Object.values(ACCOUNT_IDS);
        sourceAccountId = accounts[random(0, Math.floor(accounts.length / 2))];
        destinationAccountId = accounts[random(Math.floor(accounts.length / 2), accounts.length - 1)];
      }

      const sql = `INSERT INTO transactions (id, type, amount, date, title, property_id, category_id, source_account_id, destination_account_id, status, business_status, note, adjustment_reason, adjustment_direction, owner_person_id, payer_person_id, created_by_user_id, recurring_schedule_id, created_at, updated_at, deleted_at) VALUES ('${id}', '${item.type}', ${amount}, ${dateTimestamp}, '${title}', NULL, ${categoryId ? `'${categoryId}'` : 'NULL'}, ${sourceAccountId ? `'${sourceAccountId}'` : 'NULL'}, ${destinationAccountId ? `'${destinationAccountId}'` : 'NULL'}, 'completed', 'received', '${note.replace(/'/g, "''")}', NULL, NULL, 'person_thanet', NULL, 'user_thanet', NULL, ${createdAtTimestamp}, ${updatedAtTimestamp}, NULL);`;

      sqlStatements.push(sql);
    }
  }

  return sqlStatements;
}

// Generate and output SQL
console.log('-- Generated test data for performance validation');
console.log('-- Date range: 2026-03-22 to 2026-09-18');
console.log('-- Total records: 2000');
console.log('');

const sqlStatements = generateSQL();
for (const sql of sqlStatements) {
  console.log(sql);
}

console.log('');
console.log('-- Rollback: DELETE FROM transactions WHERE note LIKE \'%[PERF-TEST]%\';');
