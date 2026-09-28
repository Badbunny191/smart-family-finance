
Smart Family Finance
เวอร์ชันปัจจุบัน

v1.9.0

อัปเดตล่าสุด: 2026-09-26

📚 ประวัติโปรเจกต์
2026-09-06

✅ Completed

Navigation
More Menu
Bottom Navigation
Dashboard Simplification
Deployment
Production Deployment Completed
Commit

b2c5cf89

Open Issues
Form UX
Transaction Filters
Account Display
2026-09-09

✅ Completed

Transactions & Accounts
Fixed transaction creation issues
Fixed owner_person_id / payer_person_id schema mismatch
Improved cash account UX
Hide bank-only fields for cash accounts
Initialize current balance from opening balance
Categories
Category usage validation
Delete warning dialog
Show "(หมวดหมู่ถูกลบ)" ในประวัติรายการ
Data Protection

Safe-delete protection สำหรับ

Persons
Properties
Accounts
Audit Results

ตรวจสอบแล้ว

Transaction rollback ทำงานถูกต้อง
ไม่พบปัญหา balance corruption
Release

Production deployment completed

Commit

5318c67d

Tag

v1.4.0

Open Issues
Global loading states
Toast messages consistency
Dashboard refinement
2026-09-10

✅ Completed

Person Management

เปลี่ยนจาก

isDaughter


เป็น

relationship


รองรับ

พ่อ
แม่
ลูกชาย
ลูกสาว
อื่นๆ
Database
D1 Migration Completed
Release

Production deployment completed

Tag

v1.4.2

2026-09-10 (Update)

✅ Completed

Person Management
Migration เสร็จสมบูรณ์
Category UX
ปรับ Icon Picker ใหม่
เพิ่มหมวดไอคอน
ปรับสถานะเลือกไอคอน
ปรับ Layout ให้ใช้งานง่ายขึ้น
Release

Production deployment completed

Tag

v1.4.3

2026-09-11

✅ Completed

Dashboard
Fixed Recent Transactions account display
Added Transfer transaction support
Fixed Pending → Received flow
Fixed Dashboard income inconsistencies
Data Integrity
Fixed received/pending synchronization
Added status synchronization
Repaired historical inconsistent data
Account Ledger V1

เพิ่ม

/accounts/[id]


รองรับ

Today Filter
Week Filter
Month Filter
Income Summary
Expense Summary
Net Movement Summary
Transfer In
Transfer Out
Activity History
Account Not Found State
Verification
Build Passed
Manual QA Passed
Tag

v1.5.0

2026-09-19

✅ Completed

Attachment System

รองรับ

Upload Attachment
Edit Attachment
Delete Attachment
Image Preview
Lightbox Viewer
Transaction Attachments
Cloudflare Integration
R2 Storage
Image API Route
Attachment Retrieval
Production Database Repair
Root Cause
attachments.transaction_id


อ้างอิงไปยัง

transactions_old


แทน

transactions

ผลลัพธ์

✅ Upload Works

✅ Preview Works

✅ Lightbox Works

✅ Production Stable

Lessons Learned
Code เหมือนกัน
≠
Database เหมือนกัน


ต้องตรวจสอบเสมอ

Production Schema
Test Schema
Migration State

ก่อน Debug Frontend

2026-09-21

✅ Completed

LINE Notification System V1
LINE OA Integration
LINE Login
Auto Daily Summary
Cloudflare Cron Worker
Asia/Bangkok Timezone Support
Per-user Notification Settings
Per-user Schedule
Per-user Message Preferences
Preview Message
Test Send Per Recipient
Pending Details
Overdue Details
Lessons Learned
Auth Problem ≠ Notification Problem
Cron Problem ≠ Timezone Problem
UI Requirement ≠ Data Model
Always Backup D1 Before Migration
Verify Production Data Before Schema Changes
Release

Production deployment completed

Tag

v1.8.0-line-notifications

2026-09-26

✅ Completed

Pending Income & Overdue System V2
Due Date Time

เพิ่มฟิลด์

dueDateTime


รองรับ

วันที่ + เวลา


สำหรับการติดตามการรับชำระ

Pending Income Workflow

เพิ่ม Business Status

pending
received


แสดงผลเป็น

⏳ รอรับเงิน
✅ รับเงินแล้ว

Overdue Engine V2

ปรับระบบคำนวณจาก

Date Only


เป็น

Date + Time

Human Friendly Status

จากเดิม

เกินกำหนดแล้ว 0 วัน


ปรับเป็น

⚠️ เพิ่งเกินกำหนด
⚠️ เกินกำหนดแล้ว 3 ชั่วโมง
⚠️ เกินกำหนดแล้ว 2 วัน

⏳ เหลืออีก 5 ชั่วโมง
⏳ เหลืออีก 2 วัน

Dashboard Integration

เพิ่ม Dashboard Cards

⏳ รอรับเงิน
⚠️ เกินกำหนด


รองรับการกดจาก Dashboard แล้วเปิด Transaction พร้อม Filter อัตโนมัติ

Business Status Separation

แยก

Business Status


ออกจาก

Overdue Status


ตัวอย่าง

⏳ รอรับเงิน
⚠️ เกินกำหนดแล้ว 2 วัน


แทน

🟥 เกินกำหนด


อย่างเดียว

Lessons Learned
Business Status
≠
Overdue Status

UTC
≠
Asia/Bangkok

INTEGER
≠
TEXT


SQLite Type Conversion อาจทำให้ผลลัพธ์ผิดได้แม้ค่าตัวเลขดูถูกต้อง

Hard Delete Transactions
เปลี่ยนจาก
Soft Delete


เป็น

Hard Delete


สำหรับ

Transactions


เท่านั้น

Legacy Cleanup

ตรวจพบ

74 Soft Deleted Transactions


ยังอยู่ในฐานข้อมูล

หลังยกเลิก

deleted_at IS NULL


จึงถูกแสดงกลับมาอีกครั้ง

Database Cleanup

ล้างข้อมูลเก่า

74 Transactions


และ

6 Attachments


ที่ผูกกับรายการที่ถูกลบ

Validation

ตรวจสอบแล้ว

✅ Hard Delete ทำงานจริง

✅ Transaction ถูกลบจริงจาก D1

✅ Attachment ถูกลบจริงจาก D1

✅ Balance Rollback ถูกต้อง

✅ Dashboard ทำงานถูกต้อง

✅ Overdue ทำงานถูกต้อง

✅ No Soft Deleted Transactions Remaining

Lessons Learned
Soft Delete Removal
≠
Hard Delete Migration


จำเป็นต้องตรวจสอบ

Legacy Data
Attachments
Foreign Keys
Balance Rollback
Production Data

ก่อน Deploy ทุกครั้ง

Release

Production deployment completed

Commits
88c926aa
feat: complete pending income workflow and overdue UX

345fae37
feat: hard delete transactions

Tag

v1.9.0

✅ ฟีเจอร์ที่ระบบรองรับปัจจุบัน
Dashboard

รองรับ

รายรับ
รายจ่าย
คงเหลือ
รอรับเงิน
เกินกำหนด
Transactions

รองรับ

รายรับ
รายจ่าย
โอนเงิน
สถานะ
บัญชี
หมวดหมู่
หมายเหตุ
รูปแนบ
Due Date Time
Pending Income
Hard Delete
Accounts

รองรับ

เงินสด
ธนาคาร
Wallet
พร้อมเพย์
Account Ledger
Categories

รองรับ

สร้าง
แก้ไข
ลบ
Validation ก่อนลบ
Person Management

รองรับ

พ่อ
แม่
ลูกชาย
ลูกสาว
อื่นๆ
Attachments

รองรับ

Upload
Edit
Delete
Preview
Lightbox
LINE Notifications

รองรับ

AUTO Daily Summary
Per-user Settings
Test Send
Preview
Pending Report
Overdue Report
🏗️ สถาปัตยกรรมระบบ
Frontend
Next.js
React
TypeScript
Tailwind CSS
Backend
Next.js API Routes
ORM
Drizzle ORM
Database
Cloudflare D1
File Storage
Cloudflare R2
Hosting
Cloudflare Workers + OpenNext
⚠️ Technical Debt
uploaded_by_user_id

สถานะ

ยังอยู่ใน Production Schema


งานที่ต้องทำ

Migration Cleanup
Verify Test DB
Verify Production DB

Priority

⭐⭐

สถานะ

Not Urgent

transactions.deleted_at

สถานะ

ยังอยู่ใน Schema
แต่ไม่มีการใช้งานแล้ว


งานที่ต้องทำ

Remove Column
Remove Index
Migration Cleanup

Priority

⭐⭐

สถานะ

Not Urgent

🚀 Roadmap
P1 — Pending Expense System

สถานะ

Ready


เป้าหมาย

⏳ รอจ่าย
✅ จ่ายแล้ว
⚠️ เกินกำหนด


Priority

⭐⭐⭐⭐⭐

P2 — Splash Screen

สถานะ

Ready


เป้าหมาย

Logo
Smart Family Finance
กำลังโหลด...


Priority

⭐⭐⭐⭐⭐

P3 — Account Detail Redesign

ปัญหา

Card ปัจจุบันเริ่มแน่นเมื่อยอดเงินสูง

เป้าหมาย

Responsive Layout
Mobile First
Large Number Friendly

Priority

⭐⭐⭐⭐⭐

P4 — Date Filters

เพิ่ม

วันนี้
7 วัน
30 วัน
เดือนนี้
ปีนี้
กำหนดเอง

Priority

⭐⭐⭐⭐⭐

P5 — Search Improvements

ค้นหาได้จาก

ชื่อรายการ
หมายเหตุ
จำนวนเงิน
บัญชี

Priority

⭐⭐⭐⭐⭐

P6 — Payment Reminder System

รองรับ

1 วัน
3 วัน
7 วัน
14 วัน
30 วัน

Dashboard Alerts

ตัวอย่าง

ค้างชำระ 4 รายการ
รวม 12,500 บาท


Priority

⭐⭐⭐⭐

P7 — Attachment Thumbnail System

ปัจจุบัน

โหลดรูปจริงทุกครั้ง


เป้าหมาย

original.webp
thumb.webp


ผลลัพธ์

โหลดเร็วขึ้น
ประหยัด Bandwidth
Mobile Friendly

Priority

⭐⭐⭐⭐

P8 — Database Cleanup

งานที่ต้องทำ

Remove uploaded_by_user_id
Remove transactions.deleted_at
Cleanup Migration
Verify Production Schema

Priority

⭐⭐

สถานะ

Not Urgent

🎯 ลำดับความสำคัญปัจจุบัน
Pending Expense System
Splash Screen
Account Detail Redesign
Date Filters
Search Improvements
Payment Reminder System
Attachment Thumbnail System
Database Cleanup
✅ สถานะปัจจุบัน

ระบบอยู่ในสถานะ

Stable


ส่วนที่เสถียรแล้ว

Dashboard
Transactions
Accounts
Categories
Person Management
Attachments
LINE Notifications
Pending Income
Overdue System
Account Ledger
Hard Delete Transactions

พร้อมพัฒนาฟีเจอร์ใหม่ตาม Roadmap ต่อได้ 🚀🏆