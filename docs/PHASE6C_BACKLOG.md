# PHASE 6C BACKLOG: Smart Family Finance

## P0 (งานด่วนที่สุด - ต้องทำทันทีเพื่อแก้ปัญหาการใช้งานจริง)

1. **Transaction Form UX Fixes**
   - **Scope**:
     - เพิ่มปุ่มกากบาท (X) มุมขวาบนของ Form Modal/Drawer เพื่อให้กดปิดได้ทันที
     - ปรับคอนเทนเนอร์ปุ่มด้านล่างเป็น Sticky Footer ติดขอบจอล่างตลอดเวลา
     - ตรวจสอบให้ปุ่ม Save และ Cancel มองเห็นได้เสมอแม้คีย์บอร์ดมือถือจะเด้งขึ้นมา
   - **เหตุผล**: แก้ไขปัญหาที่ผู้ใช้ทดสอบจริงแล้วพบว่าออกจากฟอร์มไม่ได้และหาปุ่ม Save ไม่เจอ

2. **Transaction Filters & Default State Implementation**
   - **Scope**:
     - เพิ่ม UI แถบตัวกรองใน `src/app/transactions/page.tsx`:
       - Text Search
       - Date Filter (ช่วงวันที่)
       - Status Filter (สถานะรายการ)
       - Account Filter (บัญชีต้นทาง/ปลายทาง)
       - Category Filter (หมวดหมู่)
     - บังคับให้หน้าเว็บเปิดมาด้วยช่วงเวลา "เดือนนี้ (This Month)" เสมอ
   - **เหตุผล**: ป้องกันไม่ให้รายการทั้งหมดถูกโหลดขึ้นมาพร้อมกัน และช่วยให้ค้นหารายการได้รวดเร็ว

3. **Account Display Standard Enforcement**
   - **Scope**:
     - ปรับปรุง Component แสดงผลบัญชีทั้งใน Dropdown, List, และ Cards
     - จัดรูปแบบเป็น:
       - บรรทัดที่ 1: Alias
       - บรรทัดที่ 2: Bank Name • Account Number
   - **เหตุผล**: ทำให้รูปแบบบัญชีเป็นมาตรฐานเดียวกัน ไม่สับสนเวลาเลือกทำรายการ

4. **Transfer Validation Logic Guard**
   - **Scope**:
     - ตรวจสอบ Logic ในการสรุปยอดและ Validation ใน `src/lib/validation.ts` และ `src/lib/dashboard-data.ts`
     - ตัดยอดธุรกรรมประเภทโอนเงินระหว่างบัญชีออกจากการคำนวณฝั่งรายรับ (Income)
   - **เหตุผล**: ป้องกันตัวเลขทางบัญชีและยอดรายได้รวมบิดเบือนจากความเป็นจริง

5. **Dashboard Summary Isolation Verification**
   - **Scope**:
     - ตรวจสอบให้มั่นใจว่าหน้า Dashboard ดึงเฉพาะยอดสรุปและรายการล่าสุด (Latest only)
     - ตัดส่วนที่อาจทำให้เกิดการดึง Transactions ทั้งหมดออก
   - **เหตุผล**: สอดคล้องกับข้อกำหนดของ PO และลดภาระการประมวลผลบน Edge D1

---

## P1 (งานเสริมความมั่นคงและการป้องกันข้อผิดพลาด)

1. **Lock-down Endpoint Admin Setup (`/api/setup/admin`)**
   - **Scope**: ตรวจสอบเงื่อนไขว่าหากมีบัญชี Admin ในระบบแล้ว ต้องปฏิเสธ Request ทันที (Return 403 Forbidden)
   - **เหตุผล**: ป้องกันช่องโหว่ความปลอดภัยบน Production

2. **Transfer Calculation Automated Test**
   - **Scope**: เขียนชุดทดสอบจำลองรายการโอนเงินระหว่างบัญชี เพื่อยืนยันว่ายอดไม่ถูกนับเป็น Income
   - **เหตุผล**: คุ้มครอง Business Invariant ไม่ให้พังในอนาคต

---

## P2 (งานปรับปรุงในอนาคตและงานรออนุมัติ)

1. **Resolution of Pending Reviews**
   - **Scope**: นำเสนอและรอ PO ตัดสินใจเรื่อง:
     - `closed status`
     - `customer_not_paid`
     - `Cost Center vs Property`
     - `Archive strategy`
   - **เหตุผล**: ต้องรอการอนุมัติก่อน ห้ามลงมือทำเด็ดขาด

2. **Windows OpenNext Build Investigation**
   - **Scope**: ทดสอบการแก้ปัญหา Symlink ของ OpenNext บน Windows เพื่อลดการพึ่งพา macOS
   - **เหตุผล**: อำนวยความสะดวกให้ทีมพัฒนาบนสภาพแวดล้อม Windows