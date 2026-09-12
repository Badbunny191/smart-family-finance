/**
 * Data Repair Script: Fix inconsistent status + businessStatus
 * 
 * ปัญหา: businessStatus = 'received' แต่ status = 'pending'
 * สาเหตุ: endpoint /received ไม่ได้อัพเดท status
 * 
 * Run: 
 *   npx wrangler d1 execute smart-family-finance-db --remote --file src/scripts/fix-received-status.sql
 * 
 * หรือ dry-run ก่อน:
 *   npx wrangler d1 execute smart-family-finance-db --remote --command "SELECT COUNT(*) as count FROM transactions WHERE business_status = 'received' AND status = 'pending' AND deleted_at IS NULL"
 */

-- Dry-run: ดูข้อมูลก่อนแก้
SELECT 
  id,
  title,
  type,
  status as current_status,
  business_status as current_business_status,
  'pending' as new_status,
  business_status as new_business_status,
  date
FROM transactions 
WHERE business_status = 'received' 
  AND status = 'pending'
  AND deleted_at IS NULL;

-- จำนวนที่จะแก้
SELECT COUNT(*) as rows_to_fix
FROM transactions 
WHERE business_status = 'received' 
  AND status = 'pending'
  AND deleted_at IS NULL;
