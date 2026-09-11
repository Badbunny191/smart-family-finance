# Deployment Guide

> ⚠️ IMPORTANT
>
> โปรเจกต์นี้ใช้:
>
> - Next.js
> - OpenNext
> - Cloudflare Workers

---

## Deploy ที่ถูกต้อง

### ✅ ใช้คำสั่งนี้

```bash
npm run deploy
```

หรือ

```bash
npm run build:cloudflare
npx wrangler deploy
```

---

## ห้ามใช้

```bash
npm run build
npx wrangler deploy
```

### เหตุผล

`npm run build`

รันแค่:

```bash
next build
```

เท่านั้น

ไม่ได้สร้าง OpenNext artifact ใหม่

ทำให้ Cloudflare Worker อาจ deploy โค้ดเก่าได้
แม้ว่า

```bash
git push
```

และ

```bash
wrangler deploy
```

จะสำเร็จแล้วก็ตาม

---

## Clean Deploy

หาก Production แสดงผลไม่ตรงกับ Source Code

ให้รัน

```bash
rm -rf .next .open-next

npm run deploy
```

---

## วิธี Debug

ถ้า

```text
Source Code
≠
Production UI
```

ห้ามสรุปว่าเป็น Browser Cache ทันที

ให้ตรวจตามลำดับนี้

### 1. ตรวจ Git

```bash
git status
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

---

### 2. ตรวจ Deployment

Cloudflare

```text
Workers & Pages
→ smart-family-finance
→ Deployments
```

---

### 3. ตรวจ Runtime Code จริง

เปิด

```text
Workers
→ Active Deployment
→ Edit Code
```

ค้นหา

```text
awaiting_business_transfer
```

หรือ

```text
pending_payment
```

หรือ

```text
customer_paid
```

ถ้ายังเจอ

แปลว่า Runtime ยังใช้ Build Artifact เก่า

---

## Incident 2026-09-10

### อาการ

UI แสดง

```text
รับเงินแล้ว
รอโอนเข้าธุรกิจ
โอนเข้าธุรกิจแล้ว
ปิดรายการแล้ว
```

ทั้งที่ Source Code ถูกแก้แล้ว

เหลือ

```text
รอชำระ
รับชำระแล้ว
```

---

### สาเหตุจริง

OpenNext Artifact เก่า
ถูก Deploy ขึ้น Cloudflare Worker

ไม่ใช่

```text
Browser Cache
Cloudflare Cache
```

---

### วิธีแก้

```bash
rm -rf .next .open-next

npm run deploy
```

---

# Release v1.5.0

✅ Simplify business_status

```text
pending
received
```

✅ Add isBusinessAccount

✅ D1 Migration Complete

✅ OpenNext Deployment Fixed

✅ Deploy Process Documented



Lesson Learned

หาก production พังหลังจากแก้โค้ด

และยังไม่ได้ commit

ให้ restore กลับก่อน

อย่าเพิ่ง optimize
อย่าเพิ่ง refactor
อย่าเพิ่งวิเคราะห์ performance