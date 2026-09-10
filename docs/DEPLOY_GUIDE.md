# Deployment Guide

## ⚠️ สำคัญ - อ่านก่อน Deploy!

โปรเจกต์นี้ใช้ **Next.js + OpenNext + Cloudflare Workers**

### ❌ ห้ามใช้

```bash
npm run build && npx wrangler deploy
```

`npm run build` รันแค่ `next build` ไม่สร้าง OpenNext artifact!

### ✅ ให้ใช้

```bash
# วิธีที่ 1: ใช้ script ที่มีอยู่ (แนะนำ)
npm run deploy

# วิธีที่ 2: แยกขั้นตอน
npm run build:cloudflare
npx wrangler deploy

# วิธีที่ 3: Clean build
rm -rf .next .open-next
npm run deploy
```

## Root Cause ของปัญหาที่เคยเกิด

| Step | คำสั่ง | Output |
|------|--------|--------|
| `npm run build` | `next build` | `.next/` (Next.js only) |
| `npm run build:cloudflare` | `opennextjs-cloudflare build` | `.open-next/` (Cloudflare ready) |

## Debug Flow

เมื่อ Source Code ≠ Production UI:

1. Check git hash
2. Check deployed Worker version
3. **Check Worker Runtime Code** (ดูว่า artifact ใหม่ถูก deploy หรือยัง)
4. THEN check cache

## Scripts ที่มี

```json
"dev": "next dev"
"build": "next build"           // Next.js only
"build:cloudflare": "opennextjs-cloudflare build"  // Full pipeline
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
"preview": "wrangler dev"
```
