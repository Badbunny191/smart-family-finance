# LINE Daily Summary & Notification — Architecture & Roadmap

> **Mode**: Planning Only · **No Code Generation**
> **User**: ครอบครัว 2 คน · **ไม่มี Multi-Tenant**
> **Reference**: `docs/CURRENT_FUNCTIONAL_INVENTORY.md`, `src/db/schema.ts`, `wrangler.toml`

---

## 1. สิ่งที่มีอยู่แล้ว (จาก Source Code)

| Component | Status | รายละเอียด |
|-----------|--------|-------------|
| `lineAccounts` table | ⚠️ Dormant | FK → `users.id`, มี `lineUserId` + `notifyEnabled` แต่ไม่มี code ใช้ |
| Dashboard queries | ✅ Active | ดึง totalBalance, monthlyIncome, monthlyExpense, pending, overdue ครบหมด |
| Bangkok-time logic | ✅ Active | `isOverdue()` + SQL คำนวณ deadline = date + 7h + 1 day + 18:00 |
| D1 binding | ✅ Active | `DB` binding in wrangler.toml |
| R2 binding | ✅ Active | `BUCKET` binding (ไม่เกี่ยว) |
| Cron Trigger | ❌ Not configured | wrangler.toml ไม่มี `[triggers]` section |

---

## 2. วิเคราะห์ 7 คำถาม

### 2.1 Cloudflare Services ที่ต้องใช้

```
┌─────────────────────────────────────────────────────────┐
│                    Daily Summary Worker                   │
│                    (Cron Trigger: @daily 08:00 ICT)     │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                              ▼
   ┌─────────┐                  ┌──────────────┐
   │   D1    │                  │ LINE API     │
   │  (DB)   │                  │ Messaging    │
   └────┬────┘                  │  (Push)     │
        │                        └──────────────┘
        ▼
   Query metrics
   - totalBalance
   - monthlyIncome/Expense
   - pending (count + total)
   - overdue (count + total)
```

**Services ที่ต้องใช้:**

| Service | ใช้ทำอะไร | ต้องเพิ่มใน wrangler.toml? |
|---------|-----------|---------------------------|
| **Workers (Cron Trigger)** | รัน job ทุกวัน 08:00 | ✅ เพิ่ม `[triggers]` section |
| **D1** | Query financial data | ❌ มีอยู่แล้ว (`DB` binding) |
| **LINE Messaging API** | ส่ง push message | ❌ เป็น external HTTP call |
| **KV (optional)** | เก็บ last-send timestamp | ❌ ยังไม่จำเป็นสำหรับ MVP |

**ไม่ต้องใช้:**
- R2 (ไม่เกี่ยวกับ LINE notification)
- Durable Objects (ไม่มี stateful long-running job)
- Queue (overkill สำหรับ daily cron)

### 2.2 LINE Services ที่ต้องใช้

```
┌──────────────────────────────────────────────────────┐
│              LINE Messaging API (Push)                 │
│                                                      │
│  POST https://api.line.me/v2/bot/message/push        │
│  Authorization: Bearer {CHANNEL_ACCESS_TOKEN}         │
│                                                      │
│  ใช้ LINE Official Account (OA) ของครอบครัว        │
│  ไม่ใช่ LINE Login                                  │
│  ไม่ใช่ LINE Bot (third-party)                       │
└──────────────────────────────────────────────────────┘
```

**ทางเลือก:**

| วิธี | รายละเอียด | เหมาะกับ? |
|------|------------|-----------|
| **LINE Messaging API (Push)** | OA ส่งข้อความถึง user โดยตรง | ✅ **แนะนำ** — simple, push to 1-2 users |
| LINE Notify | OA ส่ง notification ผ่าน LINE Login | ❌ ต้อง LINE Login (โยน user ไป authorize) |
| LINE Bot (Webhook) | Bot รับ message จาก user | ❌ ซับซ้อนเกิน — ไม่ต้องรับ message |
| LINE Group Chat | OA ส่งเข้า group chat ด้วย group ID | ⚠️ alternative — group ID เปลี่ยนได้ยาก maintain |

**LINE Messaging API Push — วิธีที่ง่ายที่สุด:**

1. สร้าง LINE Official Account (ถ้ายังไม่มี) — ฟรี
2. Enable Messaging API channel
3. สร้าง Channel Access Token (long-lived)
4. เก็บ `LINE_CHANNEL_ACCESS_TOKEN` ใน Cloudflare Workers secrets
5. เก็บ `LINE_USER_ID_1`, `LINE_USER_ID_2` ของครอบครัวใน secrets หรือ env
6. Worker ส่ง push message ทุกเช้า

**LINE User ID หาได้ที่ไหน:**
- ให้ user เพิ่ม OA เป็นเพื่อน → OA จะได้ user ID
- หรือใช้ LINE OA's "Add friends" QR code + webhook trace

### 2.3 ค่าใช้จ่าย

```
┌─────────────────────────────────────────────────────────────┐
│                    ค่าใช้จ่ายในการรัน                          │
├─────────────────────┬───────────────────────────────────────┤
│ Cloudflare Workers  │ Free Tier: 100,000 req/day           │
│                     │ $5/1000 req หลังจากนั้น               │
│                     │                                       │
│                     │ Daily Summary = 1 req/day × 30 = 30 req│
│                     │ ✅ อยู่ใน Free Tier ตลอดไป           │
├─────────────────────┼───────────────────────────────────────┤
│ LINE Official       │ ฟรี — สร้าง OA ใช้งานได้เลย          │
│ Account             │                                       │
├─────────────────────┼───────────────────────────────────────┤
│ LINE Messaging API  │ Free Tier: 500 push messages/month    │
│                     │                                       │
│                     │ Daily Summary: 1/day × 30 = 30       │
│                     │ Pending/Overdue alerts: ~10/month      │
│                     │ Monthly Report: 1/month                 │
│                     │                                       │
│                     │ รวม ≈ 42 messages/month               │
│                     │ ✅ อยู่ใน Free Tier (500)              │
│                     │                                       │
│                     │ ถ้าเกิน: ฿0.35/ข้อความ (500 ข้อแรก)  │
│                     │ หรือ $13.5/1000 messages              │
├─────────────────────┼───────────────────────────────────────┤
│ Cloudflare D1       │ Free Tier: 5 DB, 1GB storage         │
│                     │ ✅ มีอยู่แล้ว (ไม่ต้องเพิ่ม)           │
├─────────────────────┼───────────────────────────────────────┤
│ Cloudflare KV       │ ไม่ต้องใช้                            │
├─────────────────────┼───────────────────────────────────────┤
│ **รวมต่อเดือน**    │ **≈ ฿0 ถ้าใช้ LINE Free Tier**       │
│                     │ **(ทั้ง Cloudflare + LINE)**          │
└─────────────────────┴───────────────────────────────────────┘
```

### 2.4 Free Tier Analysis (2 คน)

```
Daily Summary:      1 push × 2 users = 2 messages/day
Monthly Summary:    1 push × 2 users = 2 messages/month
Pending Reminder:   ~3 × 2 users       = 6 messages/month
Overdue Alert:      ~2 × 2 users       = 4 messages/month
─────────────────────────────────────────────────────────────
รวม:                ≈ 42 messages/month

LINE Free Tier:     500 messages/month
LINE OA:            ฟรี (Official Account)

✅ อยู่ใน Free Tier ได้สบายๆ — แม้แจ้งเตือนทุกวันก็ยังไม่เกิน
```

### 2.5 Cron Trigger vs วิธีอื่น

| วิธี | ข้อดี | ข้อเสีย | เหมาะกับ? |
|------|--------|---------|-----------|
| **Cloudflare Cron Trigger** | ง่าย, free, native integration, timezone support | cron expression ต้องกำหนด UTC | ✅ **แนะนำ** |
| External cron service (cron-job.org) | ยืดหยุ่นกว่า | ต้องมี external service, rate limit | ❌ ไม่จำเป็น |
| setTimeout loop ใน Worker | ไม่ต้อง cron config | Worker ต้องทำงานตลอด (expensive), cold start issues | ❌ ไม่แนะนำ |
| Cloudflare Queue + separate cron | decouple ได้ | overkill สำหรับ daily job | ❌ ไม่จำเป็น |
| D1 scheduled queries | มี beta feature | ยังเป็น beta, ไม่ stable | ❌ รอดีกว่า |

**Cloudflare Cron Trigger — วิธีที่แนะนำ:**

```toml
# wrangler.toml
[triggers]
crons = ["0 1 * * *"]  # 08:00 ICT (ICT = UTC+7 → 01:00 UTC)
```

**เพิ่มได้ใน wrangler.toml ปัจจุบัน โดยไม่ต้องเปลี่ยน config เดิม:**

```toml
[env.production.triggers]  # หรือ global [triggers]
crons = ["0 1 * * *"]
```

### 2.6 Schema Changes

**ต้องแก้ไขหรือไม่?**

```
┌──────────────────────────────────────────────────────────────┐
│  Option A: ใช้ Environment Variables (แนะนำ — No Schema Change) │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  wrangler secret put LINE_CHANNEL_ACCESS_TOKEN                │
│  wrangler secret put LINE_USER_ID_1  (ภรรยา)                 │
│  wrangler secret put LINE_USER_ID_2  (สามี)                  │
│                                                              │
│  ✅ ไม่ต้องแก้ schema                                        │
│  ✅ ไม่ต้อง migrate                                          │
│  ✅ deploy ง่าย                                              │
│  ❌ เพิ่ม user ใหม่ต้อง redeploy secrets                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Option B: ใช้ lineAccounts table (ถ้าต้องการ dynamic)       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Schema ปัจจุบัน:                                            │
│  lineAccounts: userId, lineUserId, notifyEnabled             │
│                                                              │
│  ที่ต้องเพิ่ม:                                              │
│  - personId (FK → persons.id) — เชื่อม user กับ person      │
│  - notifyDailySummary (boolean) — แยก per user               │
│  - notifyPendingReminder (boolean)                            │
│  - notifyOverdueAlert (boolean)                              │
│                                                              │
│  ✅ dynamic — user เปลี่ยน LINE ID ได้                      │
│  ✅ granular control per notification type                     │
│  ❌ schema migration                                         │
│  ❌ ซับซ้อนกว่า                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**คำตอบ: Option A สำหรับ MVP** — เพราะ 2 คน ไม่เปลี่ยนบ่อย
**คำตอบ: Option B สำหรับ Phase หลัง** — ถ้าต้องการ self-service config

### 2.7 New Tables ที่ต้องเพิ่ม

**MVP (Option A — No Schema Change):**
```
❌ ไม่ต้องเพิ่ม table ใหม่
❌ ไม่ต้องแก้ existing tables
```

**ถ้าใช้ Option B (dynamic config) ภายหลัง:**

```sql
-- เพิ่ม column ใน users หรือ lineAccounts (ถ้าต้องการ)
ALTER TABLE users ADD COLUMN person_id TEXT REFERENCES persons(id);
ALTER TABLE users ADD COLUMN notify_daily_summary INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_pending_reminder INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_overdue_alert INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN line_messaging_user_id TEXT;
```

**Table ที่ไม่ต้องแตะ:**
- `lineAccounts` — dormant V2, เก็บไว้ก่อน (อาจใช้ใน future phases สำหรับ LINE Login)

### 2.8 Risk Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                        RISK MATRIX                           │
├──────────────────┬──────────┬─────────┬─────────────────────┤
│ Risk             │ Likelihood│ Impact  │ Mitigation          │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ LINE token หมดอายุ│ Medium   │ High    │ ใช้ long-lived token │
│                  │          │         │ + alert ถ้า expire  │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ Cron ไม่ทำงาน   │ Low      │ Medium  │ wrangler tail ตอน   │
│ (Worker cold)    │          │         │ deploy + monitor     │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ LINE rate limit  │ Low      │ Medium  │ อยู่ใน 500 msgs/mo   │
│ (500 free tier)  │          │         │ + throttle logic     │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ ส่ง message ผิด  │ Low      │ Medium  │ dry-run flag ก่อน   │
│ user             │          │         │ deploy              │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ Query ใช้เวลา   │ Low      │ Low     │ Dashboard query มี   │
│ long เกิน 10s   │          │         │ อยู่แล้ว (works)    │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ LINE OA ถูก       │ Low      │ High    │ OA เป็น private     │
│ block โดย user   │          │         │ group chat ลด risk  │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ Worker timeout   │ Low      │ Low     │ 10s CPU budget เยอะ │
│ (10s CPU limit) │          │         │ พอสำหรับ D1 query   │
├──────────────────┼──────────┼─────────┼─────────────────────┤
│ Security: token  │ Low      │ High    │ wrangler secret ไม่  │
│ รั่วไหล         │          │         │ commit ลง git        │
└──────────────────┴──────────┴─────────┴─────────────────────┘
```

---

## 3. Architecture

### 3.1 High-Level

```
┌─────────────────────────────────────────────────────────────┐
│           Cloudflare Workers (Daily Summary)                │
│                                                             │
│  Trigger: cron("0 1 * * *") — 08:00 ICT ทุกวัน            │
│  Runtime: nodejs                                           │
│  CPU Budget: 10s (เพียงพอ)                                 │
│  Memory: 128MB (เพียงพอ)                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. Authenticate (service auth — no user session)   │     │
│  │ 2. Query D1 (totalBalance, income, expense, etc.)  │     │
│  │ 3. Format LINE message (flex block + Thai text)     │     │
│  │ 4. Push to LINE_USER_ID_1 + _2                    │     │
│  │ 5. Log result (optional: insert to activity_logs)  │     │
│  └─────────────────────────────────────────────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌──────────┴──────────┐
         ▼                      ▼
    ┌─────────┐           ┌────────────┐
    │   D1    │           │ LINE API   │
    │  Query  │           │ Push       │
    └─────────┘           └────────────┘
```

### 3.2 File Structure (No Code — แค่ Planning)

```
src/
├── app/
│   └── api/                          ← existing
│
├── workers/                           ← NEW (separate worker OR route)
│   └── line-notify/
│       ├── route.ts                  ← Worker entry point (GET for test)
│       ├── cron.ts                   ← cron handler
│       ├── summary.ts                ← Daily summary generator
│       ├── reminder.ts               ← Pending/Overdue checker
│       ├── monthly-report.ts         ← Monthly report sender
│       ├── line-client.ts            ← LINE Messaging API client
│       └── message-formatter.ts      ← Format LINE Flex Message
│
├── app/api/line-notify/              ← OR: ใช้ route.ts ในนี้
│   └── route.ts
│
└── lib/
    └── line-notify.ts                ← Shared LINE utilities
```

**2 ทางเลือกในการจัดวาง:**

| ทางเลือก | ข้อดี | ข้อเสีย |
|---------|-------|---------|
| **A. Separate Worker** (`workers/`) | isolated, independent deployment, ใช้ cron trigger ได้ตรงๆ | separate tsconfig, separate deploy |
| **B. API Route + External Cron** (`app/api/line-notify/route.ts`) | ใช้ existing infra, ง่ายกว่า | ต้อง external cron (cron-job.org), ไม่ใช้ Cloudflare cron โดยตรง |
| **C. Next.js Route Handler + Cloudflare Cron** | deploy รวมกับ app, ใช้ Cloudflare cron ได้ | cron trigger ต้อง config ใน wrangler ชี้ไปที่ Next.js handler |

**แนะนำ: ทางเลือก C** — เพราะ deploy รวมกับ app ง่ายที่สุด

```toml
# wrangler.toml
[triggers]
crons = ["0 1 * * *"]  # 08:00 ICT (UTC+7)

# และ export จาก Next.js route
# src/app/api/line-notify/cron/route.ts
```

### 3.3 Data Flow — Daily Summary

```
Cron Trigger (08:00 ICT)
         │
         ▼
┌─────────────────────────────────────────┐
│ GET /api/line-notify/cron               │
│ Headers: x-cron-secret: {CRON_SECRET}    │  ← validate cron source
└──────────────────┬──────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │ Query D1        │
         │ (reuse existing │
         │  dashboard      │
         │  query logic)   │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Format Message  │
         │ (Flex Bubble)   │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
  LINE Push to       LINE Push to
  USER_ID_1         USER_ID_2
  (ภรรยา)           (สามี)
```

### 3.4 LINE Message Format

ใช้ **Flex Message** (Bubble) — รองรับ Thai text ดีกว่า raw text:

```json
{
  "type": "bubble",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      { "type": "text", "text": "📊 สรุปการเงินวันที่ 22 ก.ย. 2569", "weight": "bold" },
      { "type": "separator" },
      { "type": "text", "text": "💰 ยอดรวม: 125,430 บาท" },
      { "type": "text", "text": "📈 รายรับเดือนนี้: 42,500 บาท", "color": "#16a34a" },
      { "type": "text", "text": "📉 รายจ่ายเดือนนี้: 18,700 บาท", "color": "#dc2626" },
      { "type": "text", "text": "✅ สุทธิ: +23,800 บาท", "color": "#16a34a" },
      { "type": "separator" },
      { "type": "text", "text": "⚠️ รอชำระ: 3 รายการ (18,000 บาท)", "color": "#f59e0b" },
      { "type": "text", "text": "🔴 เกินกำหนด: 1 รายการ (5,000 บาท)", "color": "#dc2626" }
    ]
  }
}
```

**ทำไมไม่ใช้ Quick Reply / Rich Menu:**
- Quick Reply = user ต้องกด reply → ไม่จำเป็นสำหรับ notification
- Rich Menu = shortcut buttons → ไม่เกี่ยวกับ daily summary
- Flex Message = แสดงข้อมูลครบใน message เดียว ✅

### 3.5 LINE Client (No Code — API Reference)

```
LINE Messaging API — Push Message
──────────────────────────────
Endpoint: POST https://api.line.me/v2/bot/message/push
Headers:
  Authorization: Bearer {LINE_CHANNEL_ACCESS_TOKEN}
  Content-Type: application/json

Body:
{
  "to": "{LINE_USER_ID}",
  "messages": [
    {
      "type": "flex",
      "altText": "สรุปการเงินประจำวัน",
      "contents": { /* Flex Message JSON */ }
    }
  ]
}

Response:
- 200 OK = ส่งสำเร็จ
- 429 = Rate limited (รอ 1 นาที retry)
- 401 = Token invalid
- 403 = OA ไม่มีสิทธิ์ push (user block หรือ OA ถูก limit)
```

---

## 4. Phase-by-Phase Roadmap

### Phase 1: Daily Summary ⭐⭐⭐⭐⭐ (MVP)

**ทำอะไร:**
- Cron trigger ทุกวัน 08:00 ICT
- Query D1: totalBalance, monthlyIncome, monthlyExpense, pending, overdue
- ส่ง Flex Message ไปทั้ง 2 user IDs

**Output ตัวอย่าง:**
```
📊 สรุปการเงินวันที่ 22 ก.ย. 2569
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 ยอดรวมทั้งหมด    125,430 บาท
📈 รายรับเดือนนี้    +42,500 บาท
📉 รายจ่ายเดือนนี้    -18,700 บาท
✅ สุทธิ              +23,800 บาท
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ รอชำระ       3 รายการ  18,000 บาท
🔴 เกินกำหนด    1 รายการ   5,000 บาท
```

**Files ที่ต้องเพิ่ม:**
```
src/app/api/line-notify/
├── cron/route.ts          ← GET: test summary; triggered by cron
└── lib/
    ├── daily-summary.ts   ← Query logic (reuse dashboard queries)
    ├── line-client.ts     ← LINE API push helper
    └── message-formatter.ts ← Format Flex Message
```

**No Schema Changes** ✅
**No New Tables** ✅
**wrangler.toml**: เพิ่ม `[triggers]` + secrets ✅

---

### Phase 2: Pending Reminder ⚠️ (Secondary)

**ทำอะไร:**
- Cron trigger ทุกวัน 08:00 ICT (รันพร้อม Daily Summary)
- Query: pending income transactions ที่ deadline = พรุ่งนี้
- ส่ง reminder แยกรายการ

**ตัวอย่าง:**
```
⚠️ เตือนการชำระเงิน (พรุ่งนี้)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ลูกค้า ABC   5,000 บาท   กำหนด 23 ก.ย.
📋 ลูกค้า DEF   8,500 บาท   กำหนด 23 ก.ย.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
รวม 2 รายการ  13,500 บาท
```

**Implementation:**
- Query: `businessStatus = 'pending' AND deadline = TOMORROW`
- Reuse existing `isOverdue()` Bangkok-time logic
- ไม่ต้องเปลี่ยน schema

**Risk ที่ต้องคิด:**
> ⚠️ **Reminder ส่งถึงใคร?**
> - ถ้าส่งถึง "เจ้าของ transaction" (owner/payer person) → ต้อง match person → user
> - ปัจจุบัน transactions มี `ownerPersonId` + `payerPersonId` แต่ไม่ได้ map ไป user
> - **MVP: ส่งให้ทั้ง 2 users เหมือนกัน** ไม่ต้อง match
> - **Future: เพิ่ม `users.personId` FK** เพื่อ match owner → user

**Status ต่อ Source Code:** ⚠️ Partial — deadline logic มีอยู่แล้ว แต่ reminder notification ไม่มี

---

### Phase 3: Overdue Alert 🔴 (Secondary)

**ทำอะไร:**
- ส่ง alert ทันทีเมื่อมี overdue หรือเมื่อ overdue count เพิ่ม
- อาจใช้ separate cron (12:00 ICT) หรือรันพร้อม Phase 1+2

**ตัวอย่าง:**
```
🔴 รายการเกินกำหนด!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ลูกค้า XYZ   12,500 บาท   เกิน 3 วัน
📋 ลูกค้า KLM    7,000 บาท   เกิน 1 วัน
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
รวม 2 รายการ  19,500 บาท
⏰ ดำเนินการทันที!
```

**หมายเหตุ:**
- Overdue = deadline เลยไปแล้ว → อาจมีกี่รายการก็ alert
- ควร deduplicate: ถ้า alert ไปแล้ววันนี้ ไม่ต้อง alert ซ้ำ

**Deduplication approach:**
```
Option A: KV key "last_overdue_alert_{date}" → set หลัง send
Option B: ไม่ deduplicate (alert ทุกครั้งที่ cron ทำงาน)
Option C: Alert เฉพาะเมื่อ count เปลี่ยน (new overdue)
```
**แนะนำ: Option A** — simple KV ฟรีใน Free Tier

---

### Phase 4: Monthly Report 📊 (Reuse Existing)

**ทำอะไร:**
- ส่งเดือนละครั้ง วันสุดท้ายของเดือน (หรือวันแรกของเดือนถัดไป)
- **Reuse existing report system** — `src/lib/report.ts` + `src/components/shareable-report.tsx`
- แปลง HTML report → LINE Flex Message (simplified)

**ตัวอย่าง:**
```
📈 รายงานประจำเดือน กันยายน 2569
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 สรุปเดือนนี้
💰 รายรับ      +125,000 บาท
💸 รายจ่าย      -78,500 บาท
✅ สุทธิ        +46,500 บาท
📈 อัตราการออม     37%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 รายการเด่น
• ค่าเช่า บ้านพัก    -15,000 บาท
• เงินเดือน บริษัท   +50,000 บาท
• ค่าน้ำ/ไฟ/อินเทอร์เน็ต  -3,800 บาท
```

**Implementation:**
- ใช้ existing `/transactions` API กับ date range filter
- Format เป็น LINE Flex Message (ไม่ใช่ PNG — LINE ไม่แสดงรูป attachment ง่าย)
- หรือส่ง PNG link ผ่าน R2 presigned URL (แต่ user ต้องกดเปิด)

**หมายเหตุ:**
- **ห้ามสร้างระบบ Report ใหม่** — reuse ที่มี
- แต่ต้องสร้าง "LINE-friendly version" ของ report เพราะ LINE Flex จำกัดกว่า PNG

---

## 5. MVP Scope Definition

### 5.1 MVP คืออะไร (Phase 1 อย่างเดียว)

```
┌─────────────────────────────────────────────────────────────┐
│  MVP: Daily Summary Only                                    │
│                                                             │
│  ✅ Cron trigger ทุกวัน 08:00 ICT                          │
│  ✅ Query D1 (totalBalance, income, expense, pending, overdue)│
│  ✅ LINE Flex Message push to 2 users                       │
│  ✅ LINE Channel Access Token via secrets                    │
│  ✅ Hardcoded LINE user IDs (2 คน)                         │
│  ✅ Test endpoint (GET /api/line-notify/cron)              │
│                                                             │
│  ❌ ไม่มี Pending Reminder (Phase 2)                      │
│  ❌ ไม่มี Overdue Alert (Phase 3)                         │
│  ❌ ไม่มี Monthly Report (Phase 4)                        │
│  ❌ ไม่มี per-user LINE ID config (hardcoded)             │
│  ❌ ไม่มี deduplication / deduplication KV               │
│  ❌ ไม่มี error notification ถ้า cron fail                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 สิ่งที่ต้องทำเพิ่ม (Pre-MVP Setup)

ก่อนเขียน code ต้อง:

1. **สร้าง LINE OA** (ถ้ายังไม่มี)
   - https://manager.line.biz/
   - Create Official Account
   - Messaging API channel

2. **ขอ Channel Access Token**
   - LINE Developers Console → Messaging API → Channel Access Token
   - Long-lived token (ไม่มีวันหมดอายุ)

3. **เก็บ LINE User IDs**
   - ทดสอบ: OA ส่งข้อความหา user คนแรก
   - webhook trace → get user ID
   - ทำซ้ำสำหรับคนที่ 2

4. **เพิ่ม secrets ใน Cloudflare**
   ```bash
   wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   # paste token
   
   wrangler secret put LINE_USER_ID_1
   # paste LINE user ID of person 1
   
   wrangler secret put LINE_USER_ID_2
   # paste LINE user ID of person 2
   ```

5. **เพิ่ม cron trigger ใน wrangler.toml**
   ```toml
   [triggers]
   crons = ["0 1 * * *"]  # 08:00 ICT daily
   ```

---

## 6. Estimated Effort

| Phase | Complexity | Effort | Risk |
|-------|-----------|--------|------|
| **Phase 1: Daily Summary (MVP)** | Low | ~2-3 hours | Low |
| **Phase 2: Pending Reminder** | Low-Medium | ~1-2 hours | Medium (user matching) |
| **Phase 3: Overdue Alert** | Low | ~1 hour | Low |
| **Phase 4: Monthly Report** | Medium | ~3-4 hours | Low |

**รวมทั้งหมด: ~7-10 hours**

### Phase 1 Breakdown

```
1. Setup LINE OA + Get Token + User IDs    30 min
2. Add wrangler secrets + cron config       10 min
3. LINE client helper (line-client.ts)     30 min
4. Message formatter (Flex Message)        30 min
5. D1 query (reuse dashboard logic)         30 min
6. Cron route handler + test              30 min
7. Deploy + Verify                         30 min
─────────────────────────────────────────────
Total:                                      ~3 hours
```

---

## 7. Recommended Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                  RECOMMENDED ARCHITECTURE                         │
│                   (สำหรับ 2 คน, No Multi-Tenant)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DEPLOYMENT                                                     │
│  ├── Next.js App + LINE Worker ใน repo เดียวกัน               │
│  ├── Route: src/app/api/line-notify/cron/route.ts              │
│  └── wrangler.toml: เพิ่ม cron trigger                          │
│                                                                 │
│  SCHEMA                                                         │
│  ├── ไม่ต้องเปลี่ยน (Phase 1-4 MVP)                           │
│  ├── Option B (dynamic config) = Phase หลัง ถ้าต้องการ         │
│  └── Dormant tables (recurring/budgets/ocr) = เก็บไว้          │
│                                                                 │
│  CONFIGURATION                                                  │
│  ├── LINE Channel Access Token → wrangler secret               │
│  ├── LINE_USER_ID_1, _2 → wrangler secrets                     │
│  └── CRON_SECRET → validate cron is from Cloudflare            │
│                                                                 │
│  NOTIFICATION FLOW                                              │
│  ├── Daily Summary (08:00) → push ทั้ง 2 users                │
│  ├── Pending Reminder (08:00) → push ทั้ง 2 users              │
│  ├── Overdue Alert (12:00) → push ทั้ง 2 users + KV dedup      │
│  └── Monthly Report (วันสุดท้ายเดือน) → push ทั้ง 2 users     │
│                                                                 │
│  MESSAGE FORMAT                                                 │
│  ├── LINE Flex Message (Bubble) — แสดง Thai text ดี          │
│  └── ไม่ใช้ PNG (LINE display PNG มีปัญหา)                   │
│                                                                 │
│  COST                                                           │
│  └── ≈ ฿0/เดือน (Cloudflare Free + LINE Free Tier เพียงพอ)   │
│                                                                 │
│  SECURITY                                                       │
│  ├── Token ใน secrets ไม่ commit ลง git                      │
│  ├── Cron route มี secret validation                          │
│  └── LINE OA ตั้ง private (accept messages from friends only)│
│                                                                 │
│  MONITORING                                                     │
│  ├── wrangler tail ดู log                                      │
│  └── LINE Messaging API → Delivery report (webhook)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Decision Tree

```
ต้องการ LINE Login หรือ LINE Bot?
├─ ใช่ → ❌ ออกจาก document นี้ (ไม่อยู่ใน scope)
└─ ไม่ → ต่อ ↓

ต้องการ push message ถึง user โดยตรง หรือ group chat?
├─ Group chat → ใช้ GROUP ID แทน USER ID (config ยากกว่า)
└─ Direct push → ✅ ต่อ ↓

ต้องการ per-user LINE ID config (dynamic)?
├─ ใช่ → เพิ่ม lineUserId ใน users table + admin UI
└─ ไม่ (แค่ 2 คน) → ✅ ใช้ secrets + hardcoded IDs

ต้องการ deduplication (ไม่ส่งซ้ำ)?
├─ ใช่ → เพิ่ม Cloudflare KV
└─ ไม่ (cron รัน 1 ครั้ง/วัน) → ✅ ไม่ต้อง KV

✅ MVP Scope: Phase 1 (Daily Summary) เท่านั้น
```

---

**Document**: Planning Only · **No Code Generated**
**Last Updated**: 2026-09-22
