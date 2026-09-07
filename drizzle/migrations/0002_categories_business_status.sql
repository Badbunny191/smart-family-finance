ALTER TABLE `transactions` ADD COLUMN `business_status` TEXT CHECK(`business_status` IN ('customer_paid', 'business_received', 'closed'));
CREATE INDEX IF NOT EXISTS `transactions_business_status_idx` ON `transactions` (`business_status`);

INSERT INTO `categories` (`id`, `name`, `type`, `icon`, `color`, `created_at`, `updated_at`, `deleted_at`) VALUES
  ('income_fish_sauce_transfer', 'ขายน้ำปลาโอน', 'income', 'Landmark', '#16866b', unixepoch(), unixepoch(), NULL),
  ('income_fish_sauce_cash', 'ขายน้ำปลาเงินสด', 'income', 'Banknote', '#16866b', unixepoch(), unixepoch(), NULL),
  ('income_other', 'รายได้อื่น', 'income', 'CirclePlus', '#16866b', unixepoch(), unixepoch(), NULL),
  ('expense_product_cost', 'ต้นทุนสินค้า', 'expense', 'Package', '#d45768', unixepoch(), unixepoch(), NULL),
  ('expense_electricity', 'ค่าไฟ', 'expense', 'Zap', '#d45768', unixepoch(), unixepoch(), NULL),
  ('expense_water', 'ค่าน้ำ', 'expense', 'Droplets', '#d45768', unixepoch(), unixepoch(), NULL),
  ('expense_internet', 'ค่าเน็ต', 'expense', 'Wifi', '#d45768', unixepoch(), unixepoch(), NULL),
  ('expense_common_fee', 'ค่าส่วนกลาง', 'expense', 'Building2', '#d45768', unixepoch(), unixepoch(), NULL),
  ('expense_repair', 'ค่าซ่อม', 'expense', 'Wrench', '#d45768', unixepoch(), unixepoch(), NULL),
  ('expense_miscellaneous', 'ค่าจิปาถะ', 'expense', 'ReceiptText', '#d45768', unixepoch(), unixepoch(), NULL);