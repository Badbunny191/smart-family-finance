# BUSINESS RULES: Smart Family Finance

## Transaction Rules
1. **Transaction Filters (P0 Requirement)**:
   - หน้ารายการธุรกรรมต้องมีระบบกรองข้อมูลครบ 5 มิติ:
     - ค้นหาด้วยข้อความ (Search)
     - กรองตามช่วงเวลา (Date Filter)
     - กรองตามสถานะ (Status Filter)
     - กรองตามบัญชี (Account Filter)
     - กรองตามหมวดหมู่ (Category Filter)
   - **Default Filter Value**: ต้องกำหนดค่าเริ่มต้นให้แสดงเฉพาะ **"เดือนนี้ (This Month)"** เสมอเมื่อเปิดหน้าเว็บ
2. **Transaction Form Rules (P0 Requirement)**:
   - ฟอร์มกรอกรายการบนมือถือต้องมีปุ่มกากบาท (X) เพื่อปิดฟอร์มได้ทันที
   - ส่วนล่างของฟอร์มต้องเป็น Sticky Footer โดยปุ่ม Save และ Cancel ต้องแสดงค้างอยู่บนจอ ไม่เลื่อนหลุดหาย

## Account Rules
1. **Account Display Standard (P0 Requirement)**:
   - การแสดงผลบัญชีทุกจุดทั่วทั้งระบบ ต้องใช้มาตรฐาน 2 บรรทัด:
     - **Primary (เด่นชัด)**: Account Alias (ชื่อเรียกบัญชี)
     - **Secondary (รองลงมา)**: Bank Name • Account Number (ชื่อธนาคาร • เลขบัญชี)
   - *ตัวอย่างที่ถูกต้อง*:
     ```text
     บัญชีน้อง
     กสิกรไทย • 123-456-7890
     ```
   - *รูปแบบเดิมที่ผิด (ห้ามใช้)*: `บัญชีน้อง (123-456-7890)`

## Category Rules
1. **Business Status Model**:
   - การจำแนกประเภทตามสถานะทางธุรกิจ ต้องยึดตามโครงสร้างเดิมใน Schema ห้ามดัดแปลง
   - กฎเกณฑ์หมวดหมู่อื่นๆ: ไม่พบข้อกำหนดเพิ่มเติมในเอกสารปัจจุบัน

## Property Rules
1. **Property Model Protection**:
   - โครงสร้างและข้อมูลของ Property ห้ามแก้ไขโดยไม่ได้รับความเห็นชอบ
2. **Cost Center vs Property**:
   - ยังไม่มีข้อสรุปทางธุรกิจ ถือเป็น **Pending Review** ห้ามนำแนวคิด Cost Center มาผูกแทน Property ในตอนนี้

## Dashboard Rules
1. **Summary Only (P0 Requirement)**:
   - หน้า Dashboard ต้องเน้นเฉพาะการสรุปตัวเลขภาพรวมทางการเงิน
   - **ข้อห้ามเด็ดขาด**: ต้องไม่ดึงหรือแสดงผลรายการธุรกรรมทั้งหมด (Must NOT display all transactions)
2. **Latest Transactions Only**:
   - แสดงได้เฉพาะรายการธุรกรรมล่าสุดจำนวนจำกัดเท่านั้น

## Transfer Rules
1. **Transfer Validation Guard (P0 Requirement)**:
   - การโอนเงินระหว่างบัญชีภายในระบบ (Internal Account Transfers) **ต้องไม่ถูกคำนวณเป็นรายรับ (Income) เด็ดขาด**
   - *ตัวอย่าง*: `บัญชีน้อง -> บัญชีธุรกิจ` ยอดเงินที่เข้าบัญชีธุรกิจต้องถูกตัดออกจากการคำนวณรายได้รวมของระบบ

## Pending Reviews (หัวข้อรอการพิจารณา - ห้าม Implement เด็ดขาด)
- สถานะ `closed`
- สถานะ `customer_not_paid`
- การปรับเปลี่ยนโครงสร้าง `Cost Center vs Property`
- นโยบายการย้ายข้อมูลเก่า `Archive strategy`