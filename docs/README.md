จัด version ให้สวยขึ้นเลย เอาไว้แปะใน README หรือ docs/deployment.md

Deployment Guide

⚠️ สำคัญ

โปรเจกต์นี้ใช้

Next.js
OpenNext
Cloudflare Workers
Cloudflare D1
Cloudflare R2
วิธี Deploy ที่ถูกต้อง
Production
npm run deploy


หรือ

npm run build:cloudflare
npx wrangler deploy

Test Environment
npm run build:cloudflare
npx wrangler deploy --env test

ห้ามใช้
npm run build
npx wrangler deploy

เหตุผล

คำสั่ง

npm run build


รันเพียง

next build


เท่านั้น

ไม่ได้สร้าง OpenNext artifact ใหม่

จึงมีโอกาสทำให้ Cloudflare Workers ถูก deploy ด้วย build เก่า แม้ว่า

git push


และ

wrangler deploy


จะสำเร็จแล้วก็ตาม

Clean Deploy

หาก Production แสดงผลไม่ตรงกับ Source Code

ให้ล้าง build artifact ก่อน

rm -rf .next .open-next

npm run deploy

Database Migration Checklist

⚠️ บทเรียนสำคัญจาก Incident Attachment Upload (2026-09)

หากมีการแก้ไข

Schema
Migration
Foreign Key
Index
D1 Structure

ต้อง Apply Migration ทั้ง Test และ Production

ลำดับที่ถูกต้อง
Code Change
    ↓
Apply Migration (Test)
    ↓
Deploy Test
    ↓
Test ผ่าน
    ↓
Apply Migration (Production)
    ↓
Deploy Production


ห้ามทำ

Apply Migration แค่ Test

แล้ว Deploy Production ทันที


เพราะอาจเกิดปัญหา

Code Version เท่ากัน

แต่ Database Schema คนละเวอร์ชัน

วิธี Debug Production

หาก

Source Code
≠
Production UI


อย่าเพิ่งสรุปว่าเป็น Browser Cache

ให้ตรวจตามลำดับนี้

1. ตรวจ Git
git status

git rev-parse HEAD

git ls-remote origin refs/heads/main

2. ตรวจ Deployment

Cloudflare Dashboard

Workers & Pages
→ smart-family-finance
→ Deployments

3. ตรวจ Runtime Code จริง

Cloudflare Dashboard

Workers
→ Active Deployment
→ Edit Code


ค้นหาคำสำคัญ เช่น

awaiting_business_transfer
pending_payment
customer_paid


หากยังพบค่าเก่า

แปลว่า Runtime ใช้ Build Artifact เก่า

Incident 2026-09-10
อาการ

Production UI แสดง

รับเงินแล้ว
รอโอนเข้าธุรกิจ
โอนเข้าธุรกิจแล้ว
ปิดรายการแล้ว


ทั้งที่ Source Code เหลือเพียง

รอชำระ
รับชำระแล้ว

สาเหตุ

OpenNext Artifact เก่า ถูก Deploy ขึ้น Cloudflare Worker

ไม่ใช่

Browser Cache
Cloudflare Cache

วิธีแก้
rm -rf .next .open-next

npm run deploy

Incident 2026-09-19
อาการ
บันทึกข้อมูลสำเร็จ
แต่อัปโหลดรูปล้มเหลว

สิ่งที่สงสัยตอนแรก
React
R2
Upload API
Image API
Cloudflare Context

Root Cause จริง

Production D1 Schema ไม่ตรงกับ Test D1

พบว่า

attachments.transaction_id
REFERENCES transactions_old(id)


แต่ตารางจริงคือ

transactions


จึงทำให้การ Insert Attachment ล้มเหลวด้วย

D1_ERROR: no such table: transactions_old

วิธีตรวจ
npx wrangler d1 execute smart-family-finance-db --remote --command "PRAGMA foreign_key_list(attachments)"

บทเรียน
Code ผ่าน
≠
Production พร้อม

ต้องตรวจ Migration และ Schema ด้วยเสมอ

Release v1.6.0

✅ Transaction Attachments

✅ Cloudflare R2 Storage

✅ Attachment Preview

✅ Full Image Viewer

✅ Attachment CRUD

✅ Production D1 Schema Repair

✅ Foreign Key Repair

✅ Upload Flow Stabilization

Lesson Learned

หาก

Test ผ่าน

แต่ Production พัง


ให้ตรวจสิ่งเหล่านี้ก่อน

1. Migration Status
2. Foreign Keys
3. D1 Schema
4. Production D1 vs Test D1


ก่อนจะเริ่มไล่

React
Performance
R2
Cloudflare Worker


เพราะปัญหาอาจอยู่ที่ Database Schema ไม่ตรงกัน ไม่ใช่ที่ Code เสมอไป 🚀