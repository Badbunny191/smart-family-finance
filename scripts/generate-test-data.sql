// Script to generate 2,000 test transactions for performance validation
// Run with: npx wrangler d1 execute testd1 --env test --file=scripts/generate-test-data.sql --remote

// ============================================================
// BEFORE RUNNING: This script will create 2,000 transactions
// ============================================================
//
// Distribution:
//   - Expense: 1,400 (70%)
//   - Income: 400 (20%)
//   - Transfer: 200 (10%)
//
// All transactions will have note starting with "[PERF-TEST]"
// Rollback: DELETE FROM transactions WHERE note LIKE '%[PERF-TEST]%'
//
// Press Ctrl+C to cancel, or confirm to proceed
// ============================================================

-- START TRANSACTION;

-- ============================================================
-- Expense Categories (70% = 1,400 transactions)
-- ============================================================

-- อาหาร (20% of total = 400)
-- Amount: 50-500
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 450 + 50) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 5)
    WHEN 0 THEN 'ซื้ออาหารกลางวัน'
    WHEN 1 THEN 'ตลาดนัดสวนจตุจักร'
    WHEN 2 THEN 'สั่ง GrabFood'
    WHEN 3 THEN 'ซื้อของในครัว'
    ELSE 'อาหารสำเร็จรูป'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_food' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - อาหาร #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 400);

-- ค่าเดินทาง (15% of total = 300)
-- Amount: 100-1000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 900 + 100) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 4)
    WHEN 0 THEN 'ค่าน้ำมันรถยนต์'
    WHEN 1 THEN 'ค่ารถไฟฟ้า BTS'
    WHEN 2 THEN 'ค่าแท็กซี่'
    ELSE 'ค่าวินมอเตอร์ไซค์'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_transport' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - ค่าเดินทาง #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 300);

-- ค่าสาธารณูปโภค (10% of total = 200)
-- Amount: 300-5000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 4700 + 300) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 4)
    WHEN 0 THEN 'ค่าไฟฟ้า กฟน.'
    WHEN 1 THEN 'ค่าน้ำประปา'
    WHEN 2 THEN 'ค่าอินเทอร์เน็ต AIS'
    ELSE 'ค่าประปานครหลวง'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_utilities' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - สาธารณูปโภค #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 200);

-- ช้อปปิ้ง (10% of total = 200)
-- Amount: 200-3000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 2800 + 200) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 4)
    WHEN 0 THEN 'ซื้อเสื้อผ้า'
    WHEN 1 THEN 'ซื้อรองเท้า'
    WHEN 2 THEN 'หยิบเติมบ้าน'
    ELSE 'ซื้อของใช้จำเป็น'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_shopping' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - ช้อปปิ้ง #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 200);

-- ความบันเทิง (8% of total = 160)
-- Amount: 100-2000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 1900 + 100) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 4)
    WHEN 0 THEN 'ดูหนังในโรง'
    WHEN 1 THEN 'ค่า Netflix'
    WHEN 2 THEN 'เกมส์ออนไลน์'
    ELSE 'ค่า Spotify'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_entertainment' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - ความบันเทิง #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 160);

-- สุขภาพ/ยา (5% of total = 100)
-- Amount: 100-3000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 2900 + 100) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 3)
    WHEN 0 THEN 'ซื้อยาที่ร้านขายยา'
    WHEN 1 THEN 'ค่าพบแพทย์'
    ELSE 'ซื้อวิตามิน'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_medical' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - สุขภาพ #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 100);

-- ค่าใช้จ่ายอื่น (4% of total = 40)
-- Amount: 50-2000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'expense' as type,
  (abs(random()) % 1950 + 50) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 3)
    WHEN 0 THEN 'ค่าบริการต่างๆ'
    WHEN 1 THEN 'บริจาคเงิน'
    ELSE 'ค่าธรรมเนียม'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_other_expense' as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  NULL as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายจ่าย - อื่นๆ #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 40);

-- ============================================================
-- Income Categories (20% = 400 transactions)
-- ============================================================

-- เงินเดือน (12% of total = 240)
-- Amount: 15000-50000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'income' as type,
  (abs(random()) % 35000 + 15000) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  'เงินเดือนประจำเดือน' as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_salary' as category_id,
  'received' as business_status,
  NULL as source_account_id,
  'acc_thanet_kbank' as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายรับ - เงินเดือน #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 240);

-- รายได้อื่น (5% of total = 100)
-- Amount: 500-10000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'income' as type,
  (abs(random()) % 9500 + 500) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 4)
    WHEN 0 THEN 'รายได้เพิ่มจากงานพิเศษ'
    WHEN 1 THEN 'ขายของมือสอง'
    WHEN 2 THEN 'ดอกเบี้ย'
    ELSE 'เงินรางวัล'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_other_income' as category_id,
  'received' as business_status,
  NULL as source_account_id,
  'acc_thanet_kbank' as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายรับ - รายได้อื่น #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 100);

-- โบนัส (3% of total = 60)
-- Amount: 5000-30000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'income' as type,
  (abs(random()) % 25000 + 5000) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  CASE (abs(random()) % 2)
    WHEN 0 THEN 'โบนัสปลายปี'
    ELSE 'โบนัสผลงาน'
  END as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  'cat_bonus' as category_id,
  'received' as business_status,
  NULL as source_account_id,
  'acc_thanet_kbank' as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] รายรับ - โบนัส #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 60);

-- ============================================================
-- Transfer (10% = 200 transactions)
-- ============================================================

-- โอนเงินระหว่างบัญชี
-- Amount: 500-10000
INSERT INTO transactions (id, type, amount, date, title, status, created_at, updated_at, deleted_at, property_id, category_id, business_status, source_account_id, destination_account_id, source_amount, destination_amount, source_currency, destination_currency, exchange_rate, note, adjustment_reason, adjustment_direction, property_name_override, created_by_user_id)
SELECT
  lower(hex(randomblob(16))) as id,
  'transfer' as type,
  (abs(random()) % 9500 + 500) as amount,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as date,
  'โอนเงินระหว่างบัญชี' as title,
  'completed' as status,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as created_at,
  datetime('2026-03-22', '+' || (abs(random()) % 180) || ' days', '+' || (abs(random()) % 86400) || ' seconds') as updated_at,
  NULL as deleted_at,
  NULL as property_id,
  NULL as category_id,
  'received' as business_status,
  'acc_thanet_kbank' as source_account_id,
  'acc_thanet_savings' as destination_account_id,
  NULL as source_amount,
  NULL as destination_amount,
  NULL as source_currency,
  NULL as destination_currency,
  NULL as exchange_rate,
  '[PERF-TEST] โอนเงิน #' || abs(random()) % 10000 as note,
  NULL as adjustment_reason,
  NULL as adjustment_direction,
  NULL as property_name_override,
  'user_thanet' as created_by_user_id
FROM generate_series(1, 200);

-- COMMIT;
