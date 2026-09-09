# KNOWN ISSUES & TECHNICAL DEBT: Smart Family Finance

## Current Bugs (ข้อผิดพลาดที่เกิดขึ้นจริงในการใช้งาน)
1. **Transaction Form UX บนมือถือ (Priority: P0)**
   - ไม่มีปุ่ม X ปิดฟอร์ม ทำให้ผู้ใช้ออกจากฟอร์มบนมือถือลำบาก
   - ไม่มี Sticky Footer
   - ปุ่ม Save และ Cancel เลื่อนหลุดขอบจอบนมือถือ
2. **Transaction Filters ขาดหาย (Priority: P0)**
   - ยังไม่มีการพัฒนา Search, Date Filter, Status Filter, Account Filter, Category Filter
   - หน้ารายการยังไม่โหลดค่าเริ่มต้นเป็น "เดือนนี้ (This Month)"
3. **Account Display ไม่ได้มาตรฐาน (Priority: P0)**
   - การแสดงผลปัจจุบันแสดงเป็น `Alias (AccountNumber)` ซึ่งอ่านยาก
   - ขาดการแยกบรรทัดเป็น Primary: `Alias` และ Secondary: `Bank Name • Account Number`

## Current UX Problems
- ข้อมูลในหน้า Dashboard เคยแสดงผลธุรกรรมหนาแน่นเกินไป (ต้องคุมให้เป็น Summary Only + Latest Only)
- การสลับหน้าจอบนมือถือต้องพึ่งพา Bottom Navigation 4 แท็บ และหน้า More เมนู ต้องทดสอบไม่ให้ปุ่มทับซ้อนกับ Sticky Footer ของ Form

## Technical Debt
1. **Windows Build Incompatibility (OpenNext Symlink Issue)**:
   - OpenNext มีปัญหากับระบบ Symlink บน Windows ทำให้ Build ไม่ผ่าน
   - ต้องใช้วิธี Deploy จาก macOS เป็นหลักในปัจจุบัน
2. **Absence of Automated Test Suite**:
   - ยังไม่มี Unit Test หรือ Integration Test สำหรับตรวจสอบสูตรคำนวณเงินและ Transfer Validation
3. **Unapproved Architecture Proposals**:
   - มีประเด็นทางสถาปัตยกรรม 4 หัวข้อที่ค้างอยู่ในสถานะ Pending Review ซึ่งหากปล่อยไว้นานอาจทำให้ Agent อื่นตีความผิด