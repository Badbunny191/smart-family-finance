/**
 * Generate PERF-TEST-V2 Dataset (200 records)
 * Purpose: Business Logic Testing
 * Date Range: 1 Jan 2569 - 19 Sep 2569
 */

import { D1Database } from '@cloudflare/workers-types';

// Configuration
const DATE_START = new Date('2026-01-01T00:00:00Z');
const DATE_END = new Date('2026-09-19T23:59:59Z');
const TOTAL_RECORDS = 200;

// Accounts
const ACCOUNTS = {
  acc_thanet_kbank: { name: 'กสิกร สำหรับใช้จ่าย thanet', person: 'person_thanet' },
  acc_thanet_savings: { name: 'ออมสิน', person: 'person_thanet' },
  acc_thanet_cash: { name: 'เงินสด Thanet', person: 'person_thanet' },
  acc_kangamon_scb: { name: 'ไทยพาณิชย์', person: 'person_kangamon' },
  acc_kangamon_cash: { name: 'เงินสด กรรณจมณ', person: 'person_kangamon' },
  acc_kangamon_business: { name: 'กรรณมณ เงินล้าน', person: 'person_kangamon' },
};

// Categories
const CATEGORIES = {
  income: {
    cat_salary: 'เงินเดือน',
    cat_bonus: 'โบนัส',
    cat_investment: 'เงินลงทุน',
    cat_other_income: 'รายได้อื่น',
  },
  expense: {
    cat_food: 'อาหาร',
    cat_transport: 'ค่าเดินทาง',
    cat_shopping: 'ช้อปปิ้ง',
    cat_utilities: 'ค่าสาธารณูปโภค',
    cat_entertainment: 'ความบันเทิง',
    cat_medical: 'สุขภาพ/ยา',
    cat_other_expense: 'ค่าใช้จ่ายอื่น',
  },
};

// Transaction patterns - Realistic business logic
const PATTERNS = [
  // INCOME - 25% (50 records)
  // Thanet salary → ออมสิน (monthly, around 25th)
  { type: 'income', category: 'cat_salary', dest: 'acc_thanet_savings', owner: 'person_thanet', minAmt: 40000, maxAmt: 60000, frequency: 'monthly', dayRange: [20, 28], weight: 12 },
  // Thanet bonus → ออมสิน (quarterly, around 10th)
  { type: 'income', category: 'cat_bonus', dest: 'acc_thanet_savings', owner: 'person_thanet', minAmt: 10000, maxAmt: 30000, frequency: 'quarterly', dayRange: [5, 15], weight: 3 },
  // Thanet investment return → ออมสิน
  { type: 'income', category: 'cat_investment', dest: 'acc_thanet_savings', owner: 'person_thanet', minAmt: 1000, maxAmt: 5000, frequency: 'random', dayRange: [1, 30], weight: 2 },
  // กรรณจมณ salary → ไทยพาณิชย์ (monthly, around 15th)
  { type: 'income', category: 'cat_salary', dest: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 30000, maxAmt: 50000, frequency: 'monthly', dayRange: [10, 20], weight: 10 },
  // กรรณจมณ bonus → ไทยพาณิชย์
  { type: 'income', category: 'cat_bonus', dest: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 8000, maxAmt: 20000, frequency: 'quarterly', dayRange: [1, 10], weight: 2 },
  // กรรณจมณ other income → ไทยพาณิชย์
  { type: 'income', category: 'cat_other_income', dest: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 500, maxAmt: 3000, frequency: 'random', dayRange: [1, 30], weight: 1 },

  // EXPENSE - 65% (130 records)
  // Thanet food → กสิกร (frequent, small amounts)
  { type: 'expense', category: 'cat_food', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 100, maxAmt: 1500, frequency: 'daily', dayRange: [1, 30], weight: 20 },
  // Thanet food → เงินสด Thanet (occasional)
  { type: 'expense', category: 'cat_food', source: 'acc_thanet_cash', owner: 'person_thanet', minAmt: 50, maxAmt: 300, frequency: 'weekly', dayRange: [1, 30], weight: 5 },
  // Thanet transport → กสิกร
  { type: 'expense', category: 'cat_transport', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 100, maxAmt: 800, frequency: 'weekly', dayRange: [1, 30], weight: 10 },
  // Thanet transport → เงินสด Thanet
  { type: 'expense', category: 'cat_transport', source: 'acc_thanet_cash', owner: 'person_thanet', minAmt: 50, maxAmt: 200, frequency: 'weekly', dayRange: [1, 30], weight: 3 },
  // Thanet shopping → กสิกร
  { type: 'expense', category: 'cat_shopping', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 200, maxAmt: 5000, frequency: 'random', dayRange: [1, 30], weight: 8 },
  // Thanet utilities → กสิกร (monthly, around 5th-10th)
  { type: 'expense', category: 'cat_utilities', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 500, maxAmt: 3000, frequency: 'monthly', dayRange: [1, 15], weight: 5 },
  // Thanet entertainment → กสิกร
  { type: 'expense', category: 'cat_entertainment', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 100, maxAmt: 2000, frequency: 'random', dayRange: [1, 30], weight: 5 },
  // Thanet medical → กสิกร
  { type: 'expense', category: 'cat_medical', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 200, maxAmt: 2000, frequency: 'random', dayRange: [1, 30], weight: 3 },
  // Thanet other → กสิกร
  { type: 'expense', category: 'cat_other_expense', source: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 100, maxAmt: 1000, frequency: 'random', dayRange: [1, 30], weight: 4 },

  // กรรณจมณ expenses
  // Food → ไทยพาณิชย์
  { type: 'expense', category: 'cat_food', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 150, maxAmt: 2000, frequency: 'daily', dayRange: [1, 30], weight: 15 },
  // Food → เงินสด กรรณจมณ
  { type: 'expense', category: 'cat_food', source: 'acc_kangamon_cash', owner: 'person_kangamon', minAmt: 50, maxAmt: 500, frequency: 'weekly', dayRange: [1, 30], weight: 5 },
  // Transport → ไทยพาณิชย์
  { type: 'expense', category: 'cat_transport', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 100, maxAmt: 1000, frequency: 'weekly', dayRange: [1, 30], weight: 8 },
  // Transport → เงินสด กรรณจมณ
  { type: 'expense', category: 'cat_transport', source: 'acc_kangamon_cash', owner: 'person_kangamon', minAmt: 50, maxAmt: 300, frequency: 'weekly', dayRange: [1, 30], weight: 2 },
  // Shopping → ไทยพาณิชย์
  { type: 'expense', category: 'cat_shopping', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 200, maxAmt: 8000, frequency: 'random', dayRange: [1, 30], weight: 8 },
  // Utilities → ไทยพาณิชย์
  { type: 'expense', category: 'cat_utilities', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 500, maxAmt: 4000, frequency: 'monthly', dayRange: [1, 15], weight: 4 },
  // Entertainment → ไทยพาณิชย์
  { type: 'expense', category: 'cat_entertainment', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 100, maxAmt: 3000, frequency: 'random', dayRange: [1, 30], weight: 5 },
  // Medical → ไทยพาณิชย์
  { type: 'expense', category: 'cat_medical', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 200, maxAmt: 3000, frequency: 'random', dayRange: [1, 30], weight: 2 },
  // Other → ไทยพาณิชย์
  { type: 'expense', category: 'cat_other_expense', source: 'acc_kangamon_scb', owner: 'person_kangamon', minAmt: 100, maxAmt: 1500, frequency: 'random', dayRange: [1, 30], weight: 3 },

  // TRANSFER - 10% (20 records)
  // Thanet: กสิกร → ออมสิน (monthly savings)
  { type: 'transfer', source: 'acc_thanet_kbank', dest: 'acc_thanet_savings', owner: 'person_thanet', minAmt: 5000, maxAmt: 15000, frequency: 'monthly', dayRange: [26, 30], weight: 5 },
  // Thanet: กสิกร → เงินสด Thanet (cash withdrawal)
  { type: 'transfer', source: 'acc_thanet_kbank', dest: 'acc_thanet_cash', owner: 'person_thanet', minAmt: 1000, maxAmt: 3000, frequency: 'biweekly', dayRange: [5, 25], weight: 3 },
  // Thanet: ออมสิน → กสิกร (emergency withdrawal)
  { type: 'transfer', source: 'acc_thanet_savings', dest: 'acc_thanet_kbank', owner: 'person_thanet', minAmt: 3000, maxAmt: 10000, frequency: 'random', dayRange: [1, 30], weight: 2 },

  // กรรณจมณ: ไทยพาณิชย์ → เงินสด
  { type: 'transfer', source: 'acc_kangamon_scb', dest: 'acc_kangamon_cash', owner: 'person_kangamon', minAmt: 2000, maxAmt: 5000, frequency: 'biweekly', dayRange: [1, 28], weight: 3 },
  // กรรณจมณ: ไทยพาณิชย์ → กรรณมณ เงินล้าน (business investment)
  { type: 'transfer', source: 'acc_kangamon_scb', dest: 'acc_kangamon_business', owner: 'person_kangamon', minAmt: 10000, maxAmt: 50000, frequency: 'monthly', dayRange: [1, 10], weight: 4 },
];

// Generate random date within range
function randomDate() {
  const startTs = DATE_START.getTime() / 1000;
  const endTs = DATE_END.getTime() / 1000;
  const randomTs = startTs + Math.random() * (endTs - startTs);
  return Math.floor(randomTs);
}

// Generate random amount
function randomAmount(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

// Get title based on category
function getTitle(type, category, accountId, month) {
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน'];
  const monthName = months[month] || 'ไม่ระบุ';

  if (type === 'income') {
    if (category === 'cat_salary') return `เงินเดือน ${monthName}`;
    if (category === 'cat_bonus') return `โบนัส ${monthName}`;
    if (category === 'cat_investment') return 'ผลตอบแทนการลงทุน';
    if (category === 'cat_other_income') return `รายได้พิเศษ ${monthName}`;
  }
  if (type === 'expense') {
    if (category === 'cat_food') return 'ซื้ออาหาร';
    if (category === 'cat_transport') return 'ค่าเดินทาง';
    if (category === 'cat_shopping') return 'ซื้อของ';
    if (category === 'cat_utilities') return 'ค่าสาธารณูปโภค';
    if (category === 'cat_entertainment') return 'ความบันเทิง';
    if (category === 'cat_medical') return 'ค่ารักษาพยาบาล';
    if (category === 'cat_other_expense') return 'ค่าใช้จ่ายอื่น';
  }
  if (type === 'transfer') {
    const destName = Object.entries(ACCOUNTS).find(([k]) => k === accountId)?.[1]?.name || accountId;
    return `โอนไป ${destName}`;
  }
  return 'ธุรกรรม';
}

// Build weighted pattern list
function buildPatternList() {
  const list = [];
  for (const p of PATTERNS) {
    for (let i = 0; i < p.weight; i++) {
      list.push(p);
    }
  }
  return list;
}

const patternList = buildPatternList();

// Generate transactions
function generateTransactions(count) {
  const transactions = [];
  const usedIds = new Set();

  for (let i = 0; i < count; i++) {
    const pattern = patternList[Math.floor(Math.random() * patternList.length)];
    const timestamp = randomDate();
    const date = new Date(timestamp * 1000);
    const month = date.getMonth();
    const amount = randomAmount(pattern.minAmt, pattern.maxAmt);

    let id;
    do {
      id = `tx_test_${i}_${Math.random().toString(36).substr(2, 9)}`;
    } while (usedIds.has(id));
    usedIds.add(id);

    const title = getTitle(pattern.type, pattern.category, pattern.dest || pattern.source, month);
    const ownerPersonId = pattern.owner;
    const categoryId = pattern.type === 'transfer' ? null : pattern.category;

    const tx = {
      id,
      type: pattern.type,
      amount,
      date: timestamp,
      title,
      category_id: categoryId,
      source_account_id: pattern.source || null,
      destination_account_id: pattern.dest || null,
      owner_person_id: ownerPersonId,
      status: 'completed',
      business_status: pattern.type === 'income' ? 'received' : 'paid',
      note: `[PERF-TEST-V2]`,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    transactions.push(tx);
  }

  // Sort by date descending
  transactions.sort((a, b) => b.date - a.date);

  return transactions;
}

// Export for use
export { generateTransactions, ACCOUNTS, CATEGORIES, PATTERNS };

// If run directly
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('generate-dataset.mjs')) {
  const txs = generateTransactions(TOTAL_RECORDS);
  console.log(JSON.stringify(txs, null, 2));
}
