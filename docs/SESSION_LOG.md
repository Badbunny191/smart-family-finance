แนะนำให้อ่านแบบนี้เลย จะกลายเป็น Project History + Current Roadmap ดูแล้วรู้ทันทีว่า

อะไรทำแล้ว
อะไรยังไม่ทำ
อะไรเป็น Technical Debt
ต้องทำอะไรก่อนหลัง
Smart Family Finance
Current Version
v1.6.x

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
Show "(หมวดหมู่ถูกลบ)" in transaction history
Data Protection

Safe-delete protection for

Persons
Properties
Accounts
Audit Results

Verified

Transaction rollback works correctly
No critical balance corruption found
Release

Production deployment completed

Commit
5318c67d

Tag
v1.4.0

Open Issues
Global loading states
Consistent toast messages
Dashboard refinement
2026-09-10
✅ Completed
Person Management
Added relationship support
Migrated from isDaughter → relationship

Supported relationships

พ่อ
แม่
ลูกชาย
ลูกสาว
อื่นๆ
Database
D1 schema migration completed
Release

Production deployment completed

Tag
v1.4.2

2026-09-10 (Update)
✅ Completed
Person Management
Fully migrated to relationship model
Category UX
Improved icon picker
Added more category icons
Better icon selection state
Improved picker layout
Release

Production deployment completed

Tag
v1.4.3

2026-09-11
✅ Completed
Dashboard
Fixed Recent Transactions account display
Added Transfer transaction support
Fixed Pending → Received business flow
Fixed Dashboard income inconsistencies
Data Integrity
Fixed received/pending synchronization
Added status synchronization
Repaired historical inconsistent data
Account Ledger V1
Added /accounts/[id]
Today filter
Week filter
Month filter
Income summary
Expense summary
Net movement summary
Transfer In / Transfer Out
Activity history
Account not found state
Verification
Build verification passed
Manual QA completed
Tag
v1.5.0

2026-09-19
✅ Completed
Attachment System
Upload Attachment
Edit Attachment
Delete Attachment
Image Preview
Lightbox Viewer
Transaction Attachments
Cloudflare
R2 Storage Integration
Image API Route
Attachment Retrieval
Production Database Repair

Root Cause

attachments.transaction_id
-> FK -> transactions_old


Production schema mismatch caused upload failure.

Fixed
transactions_old
↓
transactions

Result
Upload works
Preview works
Lightbox works
Production stable
Lessons Learned
Code same
≠
Database same


Always verify

Production schema
Test schema
Migration state

before debugging frontend.

🚀 Next Roadmap
P1 — Splash Screen
Status
Ready

Goal

Replace white screen with

Logo

Smart Family Finance

กำลังโหลด...

Priority

⭐⭐⭐⭐⭐

P2 — Account Detail Redesign
Problem

Current account summary cards

รายรับ
รายจ่าย
คงเหลือ


become crowded with large numbers.

Goal
Responsive card layout
Better spacing
Mobile-first design
Large-number friendly UI
Priority

⭐⭐⭐⭐⭐

P3 — Date Filtering
Add
วันนี้
7 วัน
30 วัน
เดือนนี้
ปีนี้
กำหนดเอง
Priority

⭐⭐⭐⭐⭐

P4 — Search Improvements
Current Problem

Search works for text

ค่าไฟ
ค่าเช่า


but not amounts

500
2500
10000

Goal

Search by

Title
Notes
Amount
Account
Priority

⭐⭐⭐⭐⭐

P5 — Payment Reminder System
Configurable Reminder
1 วัน
3 วัน
7 วัน
14 วัน
30 วัน
Dashboard Alerts
ค้างชำระ 4 รายการ

รวม 12,500 บาท

Priority

⭐⭐⭐⭐

P6 — Attachment Thumbnail System
Goal

Current

Load original image


New

original.webp
thumb.webp


Grid

thumb.webp


Viewer

original.webp

Expected Result

Faster attachment loading

Priority

⭐⭐⭐⭐

P7 — Database Cleanup
Technical Debt
attachments.uploaded_by_user_id


still exists in Production schema.

Required
Create cleanup migration
Remove uploaded_by_user_id
Verify Test DB
Verify Prod DB
Priority

⭐⭐

Status
Not urgent

Current Priority Order
1. Splash Screen

2. Account Detail Redesign

3. Date Filters

4. Search Fix

5. Payment Reminder

6. Thumbnail System

7. uploaded_by_user_id Cleanup

คัดลอกวางได้ทั้งไฟล์เลย 👇

# Smart Family Finance

## เวอร์ชันปัจจุบัน

v1.6.x

อัปเดตล่าสุด:
2026-09-21

---

# 📚 ประวัติโปรเจกต์

## 2026-09-06

✅ Completed

### Navigation

- More Menu
- Bottom Navigation
- Dashboard Simplification

### Deployment

- Production Deployment Completed

### Commit

b2c5cf89

### Open Issues

- Form UX
- Transaction Filters
- Account Display

---

## 2026-09-09

✅ Completed

### Transactions & Accounts

- Fixed transaction creation issues
- Fixed owner_person_id / payer_person_id schema mismatch
- Improved cash account UX
- Hide bank-only fields for cash accounts
- Initialize current balance from opening balance

### Categories

- Category usage validation
- Delete warning dialog
- Show "(หมวดหมู่ถูกลบ)" ในประวัติรายการ

### Data Protection

Safe-delete protection สำหรับ

- Persons
- Properties
- Accounts

### Audit Results

ตรวจสอบแล้ว

- Transaction rollback ทำงานถูกต้อง
- ไม่พบปัญหา balance corruption

### Release

Production deployment completed

### Commit

5318c67d

### Tag

v1.4.0

### Open Issues

- Global loading states
- Toast messages consistency
- Dashboard refinement

---

## 2026-09-10

✅ Completed

### Person Management

เปลี่ยนจาก

```text
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

ไม่ได้แปลว่า

Database เหมือนกัน

ต้องตรวจสอบเสมอ

Production Schema
Test Schema
Migration State

ก่อน Debug Frontend

2026-09-21

✅ Completed

Pending / Overdue System

เพิ่มระบบ

รอชำระ
เกินกำหนด
Dashboard

แสดงการ์ด

⚠️ รอชำระ
🟥 เกินกำหนด
Navigation

กดการ์ดจาก Dashboard

เชื่อมไปหน้า Transactions

พร้อม Filter อัตโนมัติ

Transactions

เพิ่ม Filter

ทั้งหมด
รับแล้ว
รอชำระ
เกินกำหนด
Date Filter Sync

เมื่อเข้าจาก Dashboard

Date Filter

↓

ทั้งหมด

อัตโนมัติ

Bangkok Timezone

แก้ปัญหา

UTC
Date rollover
Deadline calculation
Deadline Logic

Business Rule

วันที่ในฟอร์ม

=

วันส่งของ

ลูกค้าต้องชำระ

ภายใน 18:00 น.

ของวันถัดไป

ตัวอย่าง

20/09/2569

↓

21/09/2569 18:00

Lessons Learned
UTC ≠ Bangkok
Seconds ≠ Milliseconds
Debug Panel ≠ Production Logic
ตรวจสอบ Data Type ก่อนแก้ Logic เสมอ
✅ ฟีเจอร์ที่ระบบรองรับปัจจุบัน
Dashboard
รายรับ
รายจ่าย
คงเหลือ
รอชำระ
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
Accounts

รองรับ

เงินสด
ธนาคาร
Wallet
พร้อมเพย์
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
Cloudflare Pages
⚠️ Technical Debt
uploaded_by_user_id

สถานะ

ยังคงอยู่ใน Production Schema

งานที่ต้องทำ

Migration Cleanup
Verify Test DB
Verify Production DB

Priority

⭐⭐

สถานะ

Not Urgent

🚀 Roadmap
P1 — Splash Screen

สถานะ

Ready

เป้าหมาย

Logo
Smart Family Finance
กำลังโหลด...

Priority

⭐⭐⭐⭐⭐

P2 — Account Detail Redesign

ปัญหา

Card ปัจจุบัน

รายรับ
รายจ่าย
คงเหลือ

เริ่มแน่นเมื่อยอดเงินจำนวนมาก

เป้าหมาย

Responsive Layout
Mobile First
Large Number Friendly

Priority

⭐⭐⭐⭐⭐

P3 — Date Filters

เพิ่ม

วันนี้
7 วัน
30 วัน
เดือนนี้
ปีนี้
กำหนดเอง

Priority

⭐⭐⭐⭐⭐

P4 — Search Improvements

ปัจจุบัน

ค้นหาได้จากข้อความเท่านั้น

เช่น

ค่าไฟ
ค่าเช่า

เป้าหมาย

ค้นหาได้จาก

ชื่อรายการ
หมายเหตุ
จำนวนเงิน
บัญชี

Priority

⭐⭐⭐⭐⭐

P5 — Payment Reminder System

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

P6 — Attachment Thumbnail System

ปัจจุบัน

โหลดรูปจริงทุกครั้ง

เป้าหมาย

original.webp

thumb.webp

Grid

↓

thumb.webp

Viewer

↓

original.webp

ผลลัพธ์ที่คาดหวัง

โหลดเร็วขึ้น
ประหยัด Bandwidth
Mobile Friendly

Priority

⭐⭐⭐⭐

P7 — Database Cleanup

งานที่ต้องทำ

Remove uploaded_by_user_id
Cleanup Migration
Verify Test DB
Verify Production DB

Priority

⭐⭐

Status

Not Urgent

🎯 ลำดับความสำคัญปัจจุบัน

Splash Screen

Account Detail Redesign

Date Filters

Search Improvements

Payment Reminder System

Attachment Thumbnail System

uploaded_by_user_id Cleanup

สถานะปัจจุบัน

ระบบอยู่ในสถานะ

✅ Stable

ส่วนที่เสถียรแล้ว

Dashboard
Transactions
Accounts
Categories
Person Management
Attachments
Pending / Overdue System
Account Ledger

พร้อมพัฒนาฟีเจอร์ใหม่ตาม Roadmap ต่อได้


กูว่าไฟล์นี้ดีตรงที่คนเปิดมาอ่านจะรู้ทันทีว่า **ระบบมีอะไรแล้ว, เคยเจอปัญหาอะไร, ตอนนี้อยู่เวอร์ชันไหน, และงานต่อไปคืออะไร** 🚀


## Attachment System Improvements

### Performance
- Remove Base64 image rendering bottleneck
- Use direct image URLs instead of data URIs
- Add progressive image rendering
- Add per-image loading state
- Add skeleton placeholders
- Add image fade-in transitions
- Add attachment performance diagnostics

### Preview System
- Generate preview images on upload
- Support preview image endpoint
- Reduce preview image size
- Add fallback handling for missing previews

### Validation
- Fix attachment limit calculation
- Existing attachments now count toward max limit
- Prevent uploading more than 5 total attachments

### UX
- Per-image loading indicators
- Progressive image appearance
- Improved attachment gallery responsiveness

### Hard Delete Policy (2026-09-21)
**Delete Attachment:**
1. Delete original file from R2
2. Delete preview file from R2
3. Hard delete attachment record from D1

**Delete Transaction:**
1. Find all attachments by transactionId
2. Delete all original files from R2
3. Delete all preview files from R2
4. Hard delete attachment records from D1
5. Soft delete transaction + rollback balances

**Error Handling:**
- If R2 file not found → log warning but continue
- If attachment already deleted → return success
- Transaction rollback still happens even if attachments fail

## 2026-09-21 (Attachment Performance Update)

✅ Completed

### Attachment Performance Investigation

#### Problem

หลัง Deploy Attachment System

พบปัญหา

- เปิดรูปช้า
- Lightbox ใช้เวลาหลายวินาที
- บางกรณีใช้เวลามากกว่า 10 วินาที

#### Investigation

เพิ่ม Production Timing Logs เพื่อตรวจสอบ

- Compression
- Lightbox
- Image API
- Cloudflare R2
- Database
- Upload Pipeline

#### Findings

##### Compression

ตรวจสอบแล้ว

## 2026-09-23

✅ Completed

### LINE Notification System V1

- LINE OA Integration
- LINE Login
- Auto Daily Summary
- Cloudflare Cron Worker
- Asia/Bangkok Timezone Support
- Per-user Notification Settings
- Per-user Schedule
- Per-user Message Preferences
- Preview Message
- Test Send Per Recipient
- Pending Details
- Overdue Details

### Lessons Learned

- Auth Problem ≠ Notification Problem
- Cron Problem ≠ Timezone Problem
- UI Requirement ≠ Data Model
- Always backup D1 before migration
- Verify production data before schema changes

### Release

Production deployment completed

### Tag

v1.8.0-line-notifications

# Architecture Decisions

## LINE Notification Model

Decision:
Per-user notification settings

Reason:

- Supports different schedules
- Supports different message preferences
- Avoids global configuration conflicts

Rejected Option:

Global notification_settings table

Reason:

- UI flexibility loss
- Migration complexity
- Existing schema already supports per-user