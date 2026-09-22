# Phase 1 Implementation Plan: LINE Daily Summary MVP

> **Mode**: Implementation Plan Only · **No Code Generation**
> **Goal**: Daily LINE push at 08:00 ICT
> **Users**: 2 people (no multi-tenant)
> **Reference**: `docs/CURRENT_FUNCTIONAL_INVENTORY.md`, `docs/LINE_NOTIFICATION_ARCHITECTURE.md`

---

## 1. Logic ที่ Dashboard ใช้อยู่ (ห้ามเขียนซ้ำ)

### 1.1 Logic ที่มี ✅ — สามารถ Reuse ได้เลย

| Metric | Logic ที่ใช้ | ที่ไฟล์ | บรรทัด |
|--------|-------------|---------|---------|
| **Total Balance** | `SUM(accounts.currentBalance)` WHERE `accountType IN ('cash','bank')` AND `deletedAt IS NULL` | `dashboard/page.tsx` | 66-76 |
| **Monthly Income** | `SUM(transactions.amount)` WHERE `status='completed'`, `type='income'`, date >= monthStart, date < nextMonthStart | `dashboard/page.tsx` | 78-90 |
| **Monthly Expense** | `SUM(transactions.amount)` WHERE `status='completed'`, `type='expense'`, date >= monthStart, date < nextMonthStart | `dashboard/page.tsx` | 78-90 |
| **Monthly Net** | Income - Expense (computed) | `dashboard/page.tsx` | 289-299 |
| **Pending (not overdue)** | `SUM(amount), COUNT(*)` WHERE `type='income'`, `businessStatus='pending'`, deadline > now (Bangkok) | `dashboard/page.tsx` | 110-125 |
| **Overdue** | `SUM(amount), COUNT(*)` WHERE `type='income'`, `businessStatus='pending'`, deadline <= now (Bangkok) | `dashboard/page.tsx` | 130-145 |
| **Month Start/End** | `Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)` | `dashboard/page.tsx` | 60-62 |
| **Bangkok Time** | `Asia/Bangkok` timezone | `lib/utils.ts` | 179, 199 |

### 1.2 Utilities ที่มี ✅ — Import ได้เลย

| Utility | ที่ไฟล์ | บรรทัด | ใช้ทำอะไร |
|---------|---------|---------|-----------|
| `formatCurrency(amount)` | `lib/utils.ts` | 116-121 | แสดง "12,500.00 บาท" |
| `formatDate(date)` | `lib/utils.ts` | 130-136 | แสดง "22 ก.ย. 2569" |
| `getOverdueInfo(date)` | `lib/utils.ts` | 192-218 | daysOverdue, hoursUntilDeadline |
| `getBangkokDateString()` | `lib/utils.ts` | 228-231 | วันที่ปัจจุบัน Bangkok |

### 1.3 Logic ที่ต้องเขียนใหม่ ❌

| Logic | เหตุผล |
|-------|---------|
| LINE Push wrapper | ไม่มีอยู่ใน codebase |
| Flex Message formatter | ไม่มีอยู่ใน codebase |
| LINE HTTP client | ไม่มีอยู่ใน codebase |
| Cron route handler | ไม่มีอยู่ใน codebase |

### 1.4 Bangkok Deadline SQL (reuse ตรงๆ)

```sql
-- Pending (not overdue)
datetime(datetime(date, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') > datetime('now', '+7 hours')

-- Overdue
datetime(datetime(date, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')
```

### 1.5 ⚠️ สิ่งที่ต้องระวัง

**Dashboard ใช้ `Promise.allSettled` รัน 10 queries พร้อมกัน** (`dashboard/page.tsx` line 268)

```
→ สำหรับ LINE Cron: รันทีละ query หรือ group ที่ logic เกี่ยวข้องกัน
→ ไม่ต้อง Promise.allSettled เพราะ cron ต้องรู้ว่า query fail หรือไม่
```

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE WORKERS                          │
│                                                                 │
│   Cron Trigger: 0 1 * * *  (08:00 ICT = 01:00 UTC)           │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐     │
│   │         src/app/api/line-notify/                        │     │
│   │                                                          │     │
│   │  ┌──────────────────────────────────────────────────┐   │     │
│   │  │  cron/route.ts                                    │   │     │
│   │  │  ─────────────────                               │   │     │
│   │  │  GET /api/line-notify/cron                      │   │     │
│   │  │  - Validate cron secret                          │   │     │
│   │  │  - Call LINE_NOTIFY.sendDailySummary()          │   │     │
│   │  └─────────────────────┬────────────────────────────┘   │     │
│   │                        │                                 │     │
│   │                        ▼                                 │     │
│   │  ┌──────────────────────────────────────────────────┐   │     │
│   │  │  lib/line-notify.ts                              │   │     │
│   │  │  ───────────────────                             │   │     │
│   │  │                                                  │   │     │
│   │  │  getDashboardMetrics() ──────────────────────┐  │   │     │
│   │  │  1. totalBalance                               │  │   │     │
│   │  │  2. monthlyIncome                              │  │   │     │
│   │  │  3. monthlyExpense                             │  │   │     │
│   │  │  4. pendingCount + pendingTotal               │  │   │     │
│   │  │  5. overdueCount + overdueTotal               │  │   │     │
│   │  │                                                 │  │   │     │
│   │  │  formatFlexMessage(metrics) ───────────────┐   │  │   │     │
│   │  │  → LINE Flex Message JSON                  │   │  │   │     │
│   │  │                                              │   │  │   │     │
│   │  │  sendPush(userId, message) ──────────────┐  │   │  │   │     │
│   │  │  → POST https://api.line.me/v2/bot/...  │  │   │  │   │     │
│   │  └──────┬───────────────┬──────────────────┘  │   │  │   │     │
│   │         │               │                       │   │  │   │     │
│   └─────────┼───────────────┼───────────────────────┼───┼──────┘     │
│             │               │                       │   │              │
│       ┌────┴───┐     ┌────┴────┐             ┌───┴───┐            │
│       │   D1   │     │ LINE    │             │ Cloud │            │
│       │  (DB)  │     │ Messaging│             │flare  │            │
│       │        │     │   API    │             │Secrets│            │
│       └─────────┘     └─────────┘             └───────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 File Structure — สร้างใหม่

```
src/
├── app/
│   └── api/
│       └── line-notify/                    ← NEW
│           └── cron/
│               └── route.ts                ← NEW: GET handler (cron entry)
│
└── lib/
    ├── line-notify.ts                      ← NEW: core logic
    │   ├── getDashboardMetrics()           ← NEW: reuse D1 queries
    │   ├── formatDailySummaryMessage()     ← NEW: Flex Message builder
    │   └── linePushMessage()               ← NEW: LINE API call
    │
    └── utils.ts                           ← EXISTING: reuse
        ├── formatCurrency()                ← reuse
        ├── formatDate()                    ← reuse
        └── getBangkokDateString()           ← reuse
```

**ห้ามสร้าง:**
- `src/workers/` (separate worker — overkill)
- `src/lib/line-client.ts` แยก (รวมใน `line-notify.ts` เพื่อ simplicity)

### 2.3 File ที่ต้องแก้ไข

```
wrangler.toml    → เพิ่ม [triggers] cron + secrets declarations
```

**ไม่ต้องแก้:**
- ไม่ต้องแก้ existing pages (transactions, dashboard, etc.)
- ไม่ต้องแก้ existing API routes
- ไม่ต้องแก้ schema

---

## 3. Cloudflare Cron Configuration

### 3.1 Timezone Analysis

```
08:00 ICT (Asia/Bangkok) = UTC + 7

08:00 ICT = 01:00 UTC

Cron expression: 0 1 * * * (minute=0, hour=1, every day, every month, every day-of-week)
```

### 3.2 wrangler.toml Changes

```toml
# wrangler.toml — เพิ่มท้ายไฟล์เดิม

[triggers]
# รันทุกวัน 08:00 ICT (01:00 UTC)
crons = ["0 1 * * *"]

# หรือถ้าต้องการแยก env:
[env.production.triggers]
crons = ["0 1 * * *"]
```

### 3.3 Cloudflare Secrets (ต้อง set ก่อน deploy)

```bash
# ต้อง run ทีละคำสั่ง แล้ว paste values

# 1. LINE Channel Access Token
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# → paste จาก LINE Developers Console (long-lived token)

# 2. LINE User ID ของคนที่ 1
wrangler secret put LINE_USER_ID_1
# → หาได้จาก LINE OA webhook trace หรือ LINE OA dashboard

# 3. LINE User ID ของคนที่ 2
wrangler secret put LINE_USER_ID_2
# → หาได้จาก LINE OA webhook trace หรือ LINE OA dashboard

# 4. Cron secret (validate ว่า request มาจาก Cloudflare cron)
wrangler secret put CRON_SECRET
# → สุ่ม string เช่น: openssl rand -hex 32
```

### 3.4 How Cron Trigger Works

```
Cloudflare Cron
     │
     ▼
┌──────────────────────────────────────────────┐
│  Cloudflare Workers Runtime                   │
│                                              │
│  1. Cloudflare ปล่อย HTTP request ไปที่    │
│     Worker พร้อม headers:                    │
│     - CF-Cron-Controller: true              │
│     - CF-Cron-Schedule: 0 1 * * *           │
│                                              │
│  2. Worker รับ request ปกติ                 │
│     (เหมือน API route ทั่วไป)              │
│                                              │
│  3. ถ้าเป็น GET /api/line-notify/cron     │
│     → ทำงาน Daily Summary                   │
│                                              │
│  4. Response ใดๆ = สำเร็จ                  │
│     (Cloudflare ไม่สน response body)         │
└──────────────────────────────────────────────┘
```

**หมายเหตุ:** Cloudflare Cron trigger HTTP request ไปที่ Worker เหมือน user เรียก GET โดยตรง — ไม่ใช่ background task

---

## 4. LINE Push Flow

### 4.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  DAILY SUMMARY FLOW                          │
│                                                             │
│  [CLOUDFLARE CRON]                                          │
│         │                                                  │
│         ▼                                                  │
│  GET /api/line-notify/cron?secret={CRON_SECRET}            │
│         │                                                  │
│         ▼                                                  │
│  ┌─────────────────────┐                                    │
│  │ Validate CRON_SECRET│                                    │
│  │ ❌ return 401      │                                    │
│  └──────────┬──────────┘                                    │
│              │ ✅                                            │
│              ▼                                              │
│  ┌─────────────────────┐                                    │
│  │ Query D1 Metrics    │                                    │
│  │ - totalBalance      │                                    │
│  │ - monthlyIncome     │                                    │
│  │ - monthlyExpense    │                                    │
│  │ - pending           │                                    │
│  │ - overdue           │                                    │
│  └──────────┬──────────┘                                    │
│              │                                              │
│              ▼                                              │
│  ┌─────────────────────┐                                    │
│  │ Format Flex Message │                                    │
│  │ - Header           │                                    │
│  │ - Balance Summary   │                                    │
│  │ - Monthly Summary   │                                    │
│  │ - Pending/Overdue  │                                    │
│  └──────────┬──────────┘                                    │
│              │                                              │
│     ┌───────┴───────┐                                      │
│     ▼               ▼                                      │
│  [USER_1]      [USER_2]                                     │
│  LINE Push     LINE Push                                    │
│  (ภรรยา)      (สามี)                                      │
│     │               │                                      │
│     ▼               ▼                                      │
│  [LINE SERVER] ◄────┘                                      │
│  200 OK        200 OK                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 LINE Messaging API — Push Message

```
┌─────────────────────────────────────────────────────────┐
│  POST https://api.line.me/v2/bot/message/push          │
│                                                          │
│  Headers:                                                │
│    Authorization: Bearer {LINE_CHANNEL_ACCESS_TOKEN}     │
│    Content-Type: application/json                       │
│                                                          │
│  Body:                                                   │
│    {                                                     │
│      "to": "{LINE_USER_ID}",                            │
│      "messages": [                                       │
│        {                                                  │
│          "type": "text",                                │
│          "text": "สวัสดี! สรุปการเงินวันนี้..."          │
│        }                                                  │
│      ]                                                   │
│    }                                                     │
│                                                          │
│  Response Codes:                                         │
│    200 OK                    → ส่งสำเร็จ                │
│    401 Unauthorized            → Token invalid            │
│    403 OA not allowed to push → User blocked OA          │
│    429 Rate limited            → เกิน rate limit         │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Message Format

ใช้ **Text message** แทน Flex Message (ง่ายกว่า, LINE แสดงผลดี):

```
📊 Smart Family Finance
วันที่ 22/09/2569
━━━━━━━━━━━━━━━━━━━━━━
💰 คงเหลือรวม    125,430.00 บาท
📈 รายรับเดือนนี้  +42,500.00 บาท
📉 รายจ่ายเดือนนี้  -18,700.00 บาท
✅ สุทธิ            +23,800.00 บาท
━━━━━━━━━━━━━━━━━━━━━━
⚠️ รอชำระ    3 รายการ  18,000.00 บาท
🔴 เกินกำหนด  1 รายการ   5,000.00 บาท
```

**หมายเหตุ:**
- ใช้ `formatCurrency()` จาก `lib/utils.ts` ที่มีอยู่แล้ว
- ถ้าต้องการ Flex Message สวยกว่า → เพิ่มทีหลังได้ (ยังไม่จำเป็นสำหรับ MVP)

### 4.4 Secret Management

```
┌─────────────────────────────────────────────────────────────┐
│                   SECRET MANAGEMENT                          │
│                                                             │
│  Secret Name          │ Location         │ เปลี่ยนบ่อยไหม?   │
│  ─────────────────────┼──────────────────┼─────────────────│
│  LINE_CHANNEL_ACCESS  │ wrangler secret  │ ทุก 1-2 เดือน  │
│  _TOKEN                            │                   │ (long-lived) │
│                                                             │
│  LINE_USER_ID_1      │ wrangler secret  │ ไม่เปลี่ยน        │
│                                                             │
│  LINE_USER_ID_2      │ wrangler secret  │ ไม่เปลี่ยน        │
│                                                             │
│  CRON_SECRET         │ wrangler secret  │ optional         │
│                                                             │
│  ❌ ห้าม hardcode ใน code หรือ .env                    │
│  ❌ ห้าม commit secrets ลง git                           │
│  ✅ เก็บใน wrangler secret เท่านั้น                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Error Handling

### 5.1 Error Categories

```
┌─────────────────────────────────────────────────────────────┐
│  ERROR HANDLING MATRIX                                       │
│                                                              │
│  ┌────────────────────┬──────────────┬────────────────────┐   │
│  │ Error             │ Action       │ Retry?            │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ D1 query timeout  │ Log + Alert  │ No (cron won't   │   │
│  │ (>10s CPU)        │              │ re-trigger today) │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ LINE token invalid│ Log + Alert  │ No (need manual   │   │
│  │ (401)             │              │ token refresh)    │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ User blocked OA    │ Log + Skip   │ No (user blocked) │   │
│  │ (403)             │ this user    │                   │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ LINE rate limit    │ Log          │ Yes (wait 1 min)  │   │
│  │ (429)             │              │ → retry once       │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ Network error      │ Log + Alert  │ Yes (retry once)  │   │
│  │ (fetch failed)    │              │                   │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ Cron secret invalid│ Return 401   │ No (misconfig)    │   │
│  │                   │              │                   │   │
│  ├────────────────────┼──────────────┼────────────────────┤   │
│  │ User ID invalid    │ Log + Skip   │ No (wrong ID)     │   │
│  │ (404)             │ this user   │                   │   │
│  └────────────────────┴──────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Logging Strategy

```typescript
// ใช้ console.error ปกติ (Cloudflare Workers จะ log ให้อัตโนมัติ)

// Levels:
//   console.log  → INFO: "Cron started", "Query complete"
//   console.warn → WARN: "Rate limited, retrying"
//   console.error → ERROR: "D1 query failed", "Token invalid"

// Cloudflare Dashboard:
//   Workers & Pages → smart-family-finance → Logs
```

### 5.3 Retry Logic

```
Simple retry — ไม่ต้อง sophisticated retry library:

async function sendWithRetry(message: string, userId: string): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await linePushMessage(userId, message);
      return;
    } catch (error) {
      if (attempt === 2) throw error; // re-throw on last attempt
      if (isRateLimitError(error)) {
        await sleep(60_000); // wait 1 min before retry
      } else {
        throw error; // don't retry other errors
      }
    }
  }
}
```

### 5.4 Failure Handling

```
┌─────────────────────────────────────────────────────────────┐
│  WHEN CRON FAILS                                             │
│                                                              │
│  Scenario 1: D1 query failed                                 │
│  → Log error to console (Cloudflare logs)                    │
│  → No LINE message sent today                                │
│  → No automatic retry (cron won't re-trigger today)          │
│  → Manual check: wrangler tail --format pretty               │
│                                                              │
│  Scenario 2: First user push succeeded, second failed          │
│  → First user gets message ✅                                 │
│  → Second user fails → Log error                             │
│  → (Both users independent)                                   │
│                                                              │
│  Scenario 3: LINE API down globally                          │
│  → All push fail → Log error for each                        │
│  → No LINE messages sent today                               │
│  → No automatic retry today                                 │
│  → (Manual: run GET /api/line-notify/cron?secret=XXX วันถัดไป)│
│                                                              │
│  ❌ ไม่ต้องการ:                                              │
│  - Dead letter queue                                         │
│  - Persistent retry state                                     │
│  - Email/pager alert (overkill สำหรับ 2 คน)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Security Review

### 6.1 Secret Management

```
┌─────────────────────────────────────────────────────────────┐
│  SECURITY: SECRET MANAGEMENT                                 │
│                                                              │
│  ✅ GOOD                                                    │
│  ├── LINE Channel Access Token → wrangler secret (encrypted) │
│  ├── LINE User IDs → wrangler secret (encrypted)             │
│  ├── Cron Secret → wrangler secret                          │
│  └── Secrets ไม่เคย commit ลง git                          │
│                                                              │
│  ❌ BAD (ที่ต้องหลีกเลี่ยง)                                  │
│  ├── ❌ Hardcode token ใน code                              │
│  ├── ❌ ใส่ token ใน .env แล้ว commit                       │
│  ├── ❌ ใช้ .env ที่ไม่ได้ add .gitignore                  │
│  └── ❌ Log token value ใน console                           │
│                                                              │
│  📋 CHECKLIST ก่อน deploy:                                   │
│  [ ] ไม่มี hardcoded secrets ใน route.ts                   │
│  [ ] ไม่มี secrets ใน .env file                            │
│  [ ] wrangler secret ถูก set ครบทั้ง 4 secrets           │
│  [ ] CRON_SECRET ไม่เป็นค่าที่ guess ได้                   │
│  [ ] LINE token เป็น long-lived (ไม่ใช่ short-lived)         │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Access Control

```
┌─────────────────────────────────────────────────────────────┐
│  SECURITY: ACCESS CONTROL                                    │
│                                                              │
│  Cron Route (/api/line-notify/cron)                         │
│  ├── Cloudflare Cron → ปล่อย HTTP GET ไป Worker           │
│  │   ✅ Internal — ไม่ต้อง auth                              │
│  │   ✅ มาจาก Cloudflare IP เท่านั้น                       │
│  │                                                            │
│  ├── Cron Secret Validation → ถ้ามี CRON_SECRET           │
│  │   ✅ Prevent manual GET from browser                     │
│  │   ✅ ถ้าไม่มี secret=XXX ใน query → 401              │
│  │                                                            │
│  └── Public GET (no secret) → 401 Unauthorized             │
│      ✅ ป้องกัน user เปิด browser เรียกเอง              │
│                                                              │
│  LINE Messaging API                                         │
│  ├── Channel Access Token → Bearer auth                     │
│  │   ✅ Token มีสิทธิ push ได้ทั้งหมดใน OA             │
│  │                                                            │
│  └── LINE User ID → Push to specific user                   │
│      ✅ OA ส่งได้เฉพาะ friends ที่ add OA                │
│                                                              │
│  D1 Database                                                │
│  ├── DB binding ใช้ existing `DB` binding                  │
│  │   ✅ Worker มีสิทธิ read-only สำหรับ queries           │
│  │   ✅ No write (ไม่มี mutation ใน cron)                 │
│  │                                                            │
│  └── Query scope: accounts + transactions tables only        │
│      ✅ No sensitive table exposure                         │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Risk Analysis

```
┌─────────────────────────────────────────────────────────────┐
│  SECURITY RISKS                                             │
│                                                              │
│  Risk: LINE token รั่วไหล                                   │
│  Likelihood: Low                                            │
│  Impact: High (ผู้ไม่รู้จักส่งข้อความแทน OA ได้)        │
│  Mitigation:                                                │
│  - Token เก็บใน wrangler secret (encrypted at rest)       │
│  - Token ไม่เคยอยู่ใน code หรือ git                       │
│  - ถ้ารั่ว: revoke ที่ LINE Console แล้วสร้างใหม่         │
│                                                              │
│  Risk: User เปิด browser เรียก cron endpoint              │
│  Likelihood: Medium                                         │
│  Impact: Low (ถ้าไม่มี secret validation, cron ทำงาน)    │
│  Mitigation:                                                │
│  - ถ้าไม่มี CRON_SECRET → ทำงานทุกครั้งที่เรียก          │
│  - แนะนำ: เพิ่ม CRON_SECRET validation                    │
│  → GET /api/line-notify/cron?secret={CRON_SECRET}         │
│  → ถ้าไม่ match → 401                                     │
│  → Cloudflare Cron ส่ง secret ไปด้วยได้ (custom headers)   │
│                                                              │
│  Risk: LINE OA ถูก block โดย LINE                         │
│  Likelihood: Very Low                                       │
│  Impact: High (ไม่มี notification)                        │
│  Mitigation:                                                │
│  - ใช้ OA ส่วนตัว (ไม่ใช้ shared OA)                    │
│  - ตั้งค่า basic plans (ฟรี, ไม่มี spam risk)             │
│  - ถ้า block → LINE Console → appeal                       │
│                                                              │
│  Risk: D1 query expose sensitive data ผ่าน error log     │
│  Likelihood: Low                                           │
│  Impact: Low (internal log)                                  │
│  Mitigation:                                                │
│  - ไม่ log raw D1 results                                  │
│  - ไม่ log query parameters ที่มี user-specific data      │
│  - log เฉพาะ: "query complete", "X rows returned"         │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Required Secrets Summary

```bash
# คำสั่งที่ต้อง run ก่อน deploy (development machine)

# 1. LINE Channel Access Token
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN

# 2. LINE User ID ของคนที่ 1
wrangler secret put LINE_USER_ID_1

# 3. LINE User ID ของคนที่ 2
wrangler secret put LINE_USER_ID_2

# 4. Cron Secret (optional — แนะนำให้มี)
# สร้างค่าสุ่ม: openssl rand -hex 32
wrangler secret put CRON_SECRET
```

**ค้นหา LINE User ID:**
1. ให้ user add OA เป็นเพื่อน
2. OA Dashboard → Messaging API → Webhook → Enable
3. ส่ง test message จาก user ไปหา OA
4. Webhook log จะแสดง user ID

---

## 8. Execution Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────┐
│  EXECUTION FLOW — Daily at 08:00 ICT                       │
│                                                              │
│  T+0:00  Cloudflare triggers cron                           │
│          GET https://app.dev/api/line-notify/cron           │
│          Headers: CF-Cron-Controller, CF-Cron-Schedule     │
│                                                              │
│  T+0:01  Route handler starts                              │
│          Validate CRON_SECRET (if configured)                │
│          ❌ 401 → Stop                                      │
│                                                              │
│  T+0:02  Initialize Cloudflare context                       │
│          getD1() → DB binding                              │
│          getDb(d1) → Drizzle instance                       │
│                                                              │
│  T+0:03  Query 1: Total Balance                            │
│          SELECT COALESCE(SUM(currentBalance), 0)           │
│          FROM accounts WHERE accountType IN ('cash','bank')  │
│                    AND deletedAt IS NULL                    │
│                                                              │
│  T+0:04  Query 2: Monthly Income + Expense                │
│          SELECT type, COALESCE(SUM(amount), 0)             │
│          FROM transactions                                  │
│          WHERE status='completed'                           │
│            AND type IN ('income','expense')                 │
│            AND date >= monthStart                           │
│            AND date < nextMonthStart                        │
│          GROUP BY type                                       │
│                                                              │
│  T+0:05  Query 3: Pending (not overdue)                    │
│          SELECT COALESCE(SUM(amount), 0), COUNT(*)         │
│          FROM transactions                                  │
│          WHERE type='income'                                │
│            AND businessStatus='pending'                     │
│            AND datetime(date,'+7h','+1d','18:00') > now     │
│                                                              │
│  T+0:06  Query 4: Overdue                                  │
│          SELECT COALESCE(SUM(amount), 0), COUNT(*)         │
│          FROM transactions                                  │
│          WHERE type='income'                                │
│            AND businessStatus='pending'                     │
│            AND datetime(date,'+7h','+1d','18:00') <= now    │
│                                                              │
│  T+0:07  Format message                                     │
│          formatCurrency(totalBalance) → "125,430.00 บาท"   │
│          formatCurrency(income) → "+42,500.00 บาท"        │
│          formatCurrency(expense) → "-18,700.00 บาท"        │
│          Build text: "📊 Smart Family Finance..."           │
│                                                              │
│  T+0:08  Push to USER_1                                    │
│          POST https://api.line.me/v2/bot/message/push     │
│          { to: LINE_USER_ID_1, messages: [...] }            │
│          ✅ 200 OK                                          │
│                                                              │
│  T+0:09  Push to USER_2                                    │
│          POST https://api.line.me/v2/bot/message/push     │
│          { to: LINE_USER_ID_2, messages: [...] }            │
│          ✅ 200 OK                                          │
│                                                              │
│  T+0:10  Return 200 OK                                      │
│          Done.                                               │
│                                                              │
│  Total execution time: ~10 seconds (well under 10s CPU limit)│
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Files Impacted

```
┌─────────────────────────────────────────────────────────────┐
│  FILES IMPACTED                                             │
│                                                              │
│  📄 NEW FILES (create)                                       │
│  ├── src/app/api/line-notify/                              │
│  │   └── cron/route.ts                                     │
│  │       • GET handler for cron                             │
│  │       • Validates CRON_SECRET                            │
│  │       • Calls line-notify.ts                             │
│  │       • Returns JSON status                              │
│  │                                                        │
│  └── src/lib/line-notify.ts                                 │
│      • getDashboardMetrics() — D1 queries                   │
│      • formatDailySummaryMessage() — message builder         │
│      • linePushMessage() — LINE API HTTP call               │
│      • sendDailySummary() — orchestration                   │
│                                                              │
│  📝 MODIFIED FILES (edit)                                   │
│  └── wrangler.toml                                          │
│      • เพิ่ม [triggers] crons section                      │
│      • เพิ่ม secrets declarations (optional)               │
│                                                              │
│  📖 EXISTING FILES (import, no changes)                    │
│  ├── src/lib/utils.ts                                      │
│  │   • formatCurrency()                                     │
│  │   • formatDate()                                        │
│  │   • getBangkokDateString()                              │
│  │                                                        │
│  ├── src/lib/cloudflare.ts                                  │
│  │   • getD1(), getDb()                                   │
│  │                                                        │
│  └── src/db/schema.ts                                       │
│      • accounts, transactions tables                        │
│                                                              │
│  ❌ NO CHANGES TO                                            │
│  ├── src/app/dashboard/page.tsx                            │
│  ├── src/app/transactions/page.tsx                          │
│  ├── src/app/api/transactions/                             │
│  ├── src/app/api/attachments/                               │
│  └── src/components/                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Implementation Checklist

```
PRE-DEPLOY SETUP
[ ] สร้าง LINE OA (ถ้ายังไม่มี) → manager.line.biz
[ ] Enable Messaging API channel
[ ] ขอ Long-lived Channel Access Token
[ ] Get LINE User ID ของคนที่ 1 (จาก webhook trace)
[ ] Get LINE User ID ของคนที่ 2
[ ] สร้าง CRON_SECRET (openssl rand -hex 32)
[ ] Set all secrets via wrangler secret put

CODE
[ ] สร้าง src/lib/line-notify.ts
[ ] สร้าง src/app/api/line-notify/cron/route.ts
[ ] แก้ wrangler.toml เพิ่ม [triggers]

DEPLOY & VERIFY
[ ] npm run build:cloudflare
[ ] wrangler deploy (หรือ npm run deploy)
[ ] wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
[ ] wrangler secret put LINE_USER_ID_1
[ ] wrangler secret put LINE_USER_ID_2
[ ] wrangler secret put CRON_SECRET
[ ] Test: GET /api/line-notify/cron?secret={CRON_SECRET}
[ ] Verify LINE message received
[ ] Check wrangler tail for logs
```

---

## 11. Estimated Effort

| Task | Effort |
|------|--------|
| Setup LINE OA + get tokens + user IDs | 30 min |
| Set wrangler secrets | 10 min |
| Write `src/lib/line-notify.ts` | 1 hour |
| Write `src/app/api/line-notify/cron/route.ts` | 30 min |
| Edit `wrangler.toml` | 10 min |
| Deploy + test | 30 min |
| **รวม** | **~2.5 hours** |

---

## 12. Summary

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1 MVP — AT A GLANCE                                  │
│                                                              │
│  Architecture:    Next.js API Route + Cloudflare Cron        │
│  Files created:  2 files                                    │
│  Files modified:  1 file (wrangler.toml)                   │
│  Schema changes: None                                       │
│  New tables:     None                                       │
│  New services:   LINE Messaging API Push                    │
│  Secrets:       4 (LINE_TOKEN, USER_1, USER_2, CRON_SECRET)│
│  Cost:          ฿0 (Free Tier เพียงพอ)                    │
│  Complexity:    Low                                          │
│  Risk:          Low-Medium                                  │
│  Effort:        ~2.5 hours                                  │
│                                                              │
│  Reuses from codebase:                                       │
│  • D1 queries (from dashboard)                             │
│  • formatCurrency(), formatDate() (from lib/utils.ts)       │
│  • Bangkok-time logic (from lib/utils.ts)                   │
│  • Cloudflare D1 binding (from lib/cloudflare.ts)           │
│                                                              │
│  Does NOT require:                                           │
│  • LINE Login                                               │
│  • LINE Bot                                                 │
│  • New report system                                        │
│  • KV / Queue / Durable Objects                            │
│  • Schema migration                                         │
│  • Multi-tenant support                                     │
└─────────────────────────────────────────────────────────────┘
```

---

**รออนุมัติก่อนเริ่ม Implement**

พิมพ์ **"อนุมัติ"** เพื่อเริ่มทำ Phase 1
พิมพ์ **"แก้ไข"** พร้อมระบุสิ่งที่ต้องการเปลี่ยน
