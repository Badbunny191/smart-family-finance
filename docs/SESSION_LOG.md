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

