# Current Functional Inventory

> **สแกนจาก Source Code** — `/Users/thanet/smart-family-finance`
> **Release**: v1.6.x · **Latest commit**: `6d9482b1` (2026-09-22)
> **Stack**: Next.js 16 + Cloudflare Workers + D1 (SQLite) + R2
>
> เอกสารนี้ตอบทันทีว่า:
> 1. ระบบมีอะไรแล้ว
> 2. รองรับอะไรแล้ว
> 3. Feature ทำเสร็จแล้ว
> 4. Feature ทำได้บางส่วน
> 5. Feature ที่ยังไม่มี
> 6. Technical Debt ที่เหลือ
> 7. Roadmap Validation (ทำแล้ว vs ยังอยู่ใน Roadmap)

---

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ Complete | ใช้งานได้ครบถ้วน production-ready |
| ⚠️ Partial | ทำได้บางส่วน มีจุดที่ยังขาด |
| ❌ Missing | ยังไม่มี / ยังไม่ได้เริ่ม |

---

# 1. Dashboard

**Status: ✅ Complete (with notes)**

**File**: `src/app/dashboard/page.tsx` (server component)

### ✅ มีอะไรแล้ว
- Hero card: ยอดรวมทั้งหมด (Total Balance) → link ไป `/accounts`
- ยอดธุรกิจรวม (Business Total) + ยอดส่วนตัว (Personal Total)
- Quick Action 3 ปุ่ม: รายรับ / รายจ่าย / โอนเงิน → link พร้อม query string ไป `/transactions`
- Business Accounts Accordion (group by person, sort by balance DESC)
- Personal Accounts Accordion (group by person, sort by balance DESC)
- Monthly Cash Flow (เดือนปัจจุบัน UTC): Net Balance / Income / Expense / Adjustment
- Financial Health KPIs: Savings Rate / Cash Ratio / Business Ratio
- Pending + Overdue dual cards (Bangkok-time aware: deadline = date + 1 day 18:00)
- Recent Transactions (10 รายการล่าสุด รวม income/expense/transfer/adjustment)
- แสดง source/destination account สำหรับ transfer
- Sign Out button

### หมายเหตุ
- เดือนปัจจุบัน fix ที่ "เดือนนี้" เท่านั้น (ไม่มี Date picker บน Dashboard)
- `person-accordion-card.tsx` ใช้ accordion แสดงบัญชีในแต่ละคน

### ❌ Missing
- Date range picker (ใช้ custom period บน Dashboard)
- Multi-month comparison (เปรียบเทียบเดือนก่อนหน้า)

---

# 2. Transactions

**Status: ✅ Complete (Core) + ⚠️ Partial (Bulk)**

**Files**: `src/app/transactions/page.tsx` (client) + `src/app/api/transactions/route.ts` + `src/app/api/transactions/[id]/route.ts` + `src/app/api/transactions/[id]/received/route.ts`

### ✅ มีอะไรแล้ว

#### CRUD (Full)
- Create (POST /api/transactions) — income/expense/transfer/adjustment ครบ 4 ประเภท
- Read (GET /api/transactions) — pagination + filters
- Update (PATCH /api/transactions/[id])
- Mark as Received (POST /api/transactions/[id]/received) — สำหรับ businessStatus='pending'
- Delete (DELETE /api/transactions/[id]) — admin-gated สำหรับ adjustment, soft delete + rollback balance + cleanup R2 attachments

#### Filters (API + UI)
| Filter | Status | หมายเหตุ |
|--------|--------|----------|
| Type | ✅ | income/expense/transfer/adjustment/all |
| Business Status | ✅ | pending/received/all (รวม overdue computed) |
| Overdue | ✅ | pending + overdue boolean |
| Category | ✅ | by categoryId |
| Account | ✅ | source OR destination match |
| Date range | ✅ | dateFrom/dateTo |
| Search | ✅ | client-side: title/note/category/account names + numeric (amount fuzzy match) |
| Sort | ✅ | date_desc/date_asc/amount_desc/amount_asc + persisted to localStorage |
| Pagination | ✅ | page/limit query params |

#### Date Filters (P3 - DONE)
- วันนี้ / 7 วัน / 30 วัน / เดือนนี้ / กำหนดเอง (custom) / ทั้งหมด
- `DateFilterOption = 'today' | '7days' | '30days' | 'month' | 'custom' | 'all'`

#### Search Improvements (P4 - DONE)
- Search by title ✅
- Search by note ✅
- Search by category name ✅
- Search by source/destination account name ✅
- Search by amount (numeric fuzzy match) ✅

#### Form & UX
- Form รองรับ 4 transaction types
- Bangkok-date aware (Asia/Bangkok) สำหรับ pending deadline
- Adjustment direction (increase/decrease) + adjustment reason
- Owner/Payer person assignment
- Property assignment
- Attachments ผ่าน `AttachmentPicker` (parallel compression)
- Auto-save selected category from URL param
- Hide bank-only fields สำหรับ cash account
- Sticky filter bar (V4)

#### Pending → Received Flow
- Link pending items ไปยัง /api/transactions/[id]/received
- Bangkok-time deadline aware (18:00 next day)

### ⚠️ Partial
- Status filter สำหรับ cancelled transactions: มี schema `cancelled` แต่ UI ไม่ได้ expose filter
- Bulk actions: ไม่มี (ทำทีละรายการ)

### ❌ Missing
- Recurring transactions: schema มี `recurringScheduleId` แต่ API ตั้ง `null` ตอน insert (V2 Dormant)
- CSV/Excel export
- Import transactions from CSV

---

# 3. Accounts

**Status: ✅ Complete**

**Files**: `src/app/accounts/page.tsx` + `src/app/accounts/[id]/page.tsx` + `src/app/api/accounts/route.ts` + `src/app/api/accounts/[id]/route.ts` + `src/app/api/accounts/[id]/usage/route.ts`

### ✅ มีอะไรแล้ว

#### Accounts List (`/accounts`)
- แสดงบัญชีทั้งหมด group by person, sort by balance DESC
- Filter by type (cash/bank)
- Search by account name
- Quick action: ดูยอดคงเหลือ + ยอดเริ่มต้น
- Create / Edit / Delete with usage validation

#### Account Detail (`/accounts/[id]`) - Account Ledger V1
- Today / Week / Month / Custom / All date filters ✅ (P3 DONE)
- Search (title/note/account number normalized)
- Sort (date_desc/date_asc/amount_desc/amount_asc)
- Income / Expense / Net / Adjustment summary cards
- Transfer In / Transfer Out summary
- Activity history
- Account not found state
- Edit account (alias/bank/account number/opening balance)
- Delete account (with usage check)

#### Account API
- POST/PATCH/DELETE with validation (`accountInputSchema`)
- `/usage` endpoint returns usage count (for safe-delete warning)
- business/personal flag, currentBalance = openingBalance initialization

### ❌ Missing
- P2 Account Detail Redesign (responsive card layout, mobile-first) — เป็น roadmap แต่ยังไม่ได้ redesign
- Account reconciliation history (track การ reconcile ยอด)

---

# 4. Categories

**Status: ✅ Complete**

**Files**: `src/app/categories/page.tsx` + `src/app/api/categories/route.ts` + `src/app/api/categories/[id]/route.ts` + `src/app/api/categories/[id]/usage/route.ts`

### ✅ มีอะไรแล้ว
- CRUD ครบ (Create/Edit/Delete)
- Icon picker (custom-built `icon-picker.tsx`)
- Color picker (custom-built `color-picker.tsx`)
- Type filter: income/expense
- Active/Inactive toggle
- Usage validation: ถ้ามี transaction ใช้ category → แสดง warning ก่อนลบ
- "หมวดหมู่ถูกลบ" badge ใน transaction history เมื่อ soft-deleted
- "หมวดหมู่" Lucide icon → emoji mapping สำหรับ LINE Report (`lib/report.ts`)

### ❌ Missing
- Bulk actions
- Category reordering (sortOrder)
- Category hierarchy (parent/child)

---

# 5. Persons

**Status: ✅ Complete**

**Files**: `src/app/persons/page.tsx` + `src/app/api/persons/route.ts` + `src/app/api/persons/[id]/route.ts` + `src/app/api/persons/[id]/usage/route.ts`

### ✅ มีอะไรแล้ว
- CRUD ครบ
- Relationship enum: father / mother / son / daughter / other (แทน isDaughter เดิม — migration สำเร็จ)
- Usage validation: ตรวจ accounts + properties ที่ใช้ person
- Safe-delete protection (ถ้ามี reference → ห้ามลบ)
- Person grouping ใน Dashboard

### ❌ Missing
- Person avatar/image
- Contact info (phone/email) — schema ไม่มี field
- Birthday/anniversary

---

# 6. Properties

**Status: ✅ Complete**

**Files**: `src/app/properties/page.tsx` + `src/app/api/properties/route.ts` + `src/app/api/properties/[id]/route.ts` + `src/app/api/properties/[id]/usage/route.ts`

### ✅ มีอะไรแล้ว
- CRUD ครบ
- Owner person assignment
- Status: active/inactive
- Usage validation
- Zero-balance stored (computed via account rollups)
- Properties เป็น dimension สำหรับ group transactions

### ❌ Missing
- Property image
- Property address

---

# 7. Attachments

**Status: ✅ Complete**

**Files**: `src/components/ui/attachment-manager.tsx` + `src/components/ui/attachment-picker.tsx` + `src/app/api/attachments/route.ts` + `src/app/api/attachments/[id]/route.ts` + `src/app/api/attachments/[id]/image/route.ts` + `src/lib/image-compression.ts`

### ✅ มีอะไรแล้ว

#### Upload Pipeline
- Client-side compression (1600px max, WebP Q90) → `originalPreview`
- Client-side preview compression (128px max, WebP Q30) → `previewImage`
- Server-side decode → validate → server-side dimension handling
- **Parallel R2 PUT** (original + preview) via `Promise.all([uploadOriginalPromise, uploadPreviewPromise])`
- D1 record insert (after R2 success)
- Max 5 attachments per transaction (validated server-side)
- Allowed types: webp, jpeg, jpg, png, gif
- Max size: 10MB

#### Retrieval
- **Streaming** (`GET /api/attachments/[id]/image`) — no buffering, `new Response(r2Object.body)` direct
- Supports `?size=preview` query param (with fallback to original)
- Cache-Control: `public, max-age=31536000, immutable`

#### Lightbox (in transactions/page.tsx)
- Click attachment → fetch original → blob → `URL.createObjectURL`
- Cache via `Map<string, string>` (in-memory `originalUrls`)
- Loading state (Loader2 spinner)
- Error handling

#### Delete
- DELETE attachment → R2 original + preview delete + D1 soft-delete
- DELETE transaction → cascade R2 cleanup for all attachments + D1 cleanup

### ⚠️ Partial
- **P6 Attachment Thumbnail System**: ยังใช้ preview (128px) ที่ generate ตอน upload — ไม่มี "thumb" tier แยก
  - ระบบปัจจุบันมีแค่ 2 tier: original (1600px Q90) + preview (128px Q30)
  - ไม่มี thumbnail tier แยก (เช่น 256px Q70)
- Loading state ใน gallery: ใช้ blob URL loading state แบบ manual

### ❌ Missing
- Multi-image upload (drag & drop many → parallel upload มี แต่ UX ยังทีละชุด)
- Image EXIF stripping
- OCR (schema `ocr_results` มี แต่ Dormant V2)

---

# 8. Pending / Overdue

**Status: ✅ Complete**

**Files**: `src/lib/utils.ts` (isOverdue, getOverdueInfo) + Dashboard queries + transactions filter

### ✅ มีอะไรแล้ว
- Bangkok-time deadline computation: `date + 7h (UTC→Bangkok) + 1 day + 18:00`
- Dashboard summary (Pending + Overdue separated)
- Transactions filter (status: pending / overdue)
- API SQL: `sql\`datetime(datetime(${transactions.date}, 'unixepoch', '+7 hours'), '+1 day', '18:00:00') <= datetime('now', '+7 hours')\``
- Mark as Received flow

### ❌ Missing
- **P5 Payment Reminder System** (Roadmap):
  - ❌ Configurable reminder (1/3/7/14/30 วัน) — **DONE แล้วใน Dashboard ผ่าน deadline logic แต่ไม่มี config**
  - ❌ Push notification (LINE Notify / Email)
  - ❌ Multi-tier reminder schedule
  - ❌ Reminder history log
- **Schema `lineAccounts`** มี `notifyEnabled` field แต่ **ไม่มีการใช้งาน** (Dormant V2)

---

# 9. Reports

**Status: ✅ Complete (Share to LINE)**

**Files**: `src/lib/report.ts` + `src/components/shareable-report.tsx` + `src/app/settings/share-report/page.tsx`

### ✅ มีอะไรแล้ว
- Generate report by period: today / week / month / custom
- PNG render ผ่าน `html-to-image`
- Native Share API (`navigator.share`) — เปิด LINE บน iOS/Android
- Fallback download PNG
- Income/Expense summary + transaction list
- Category icon → emoji mapping (สำหรับ LINE compatibility)
- Thai date formatting

### ❌ Missing
- Multi-period comparison (เช่น เดือนนี้ vs เดือนก่อน)
- Chart/graph (line, bar, pie)
- PDF export
- Email scheduled reports
- Auto-send to LINE (cron)

---

# 10. Search

**Status: ✅ Complete (across Transactions & Account Detail)**

### ✅ มีอะไรแล้ว

| Module | Search Targets | Status |
|--------|---------------|--------|
| `/transactions` | title, note, category name, source/dest account name, amount (numeric fuzzy) | ✅ |
| `/accounts/[id]` | title, note, account number (normalized) | ✅ |
| `/accounts` | account name | ✅ |

### ⚠️ Partial
- **Dashboard**: ❌ ไม่มี search (recent transactions only)
- **Persons / Properties / Categories**: ❌ ไม่มี search
- **Global search (Cmd+K)**: ❌ ไม่มี

### Implementation Detail
- Client-side filter (transactions/page.tsx) — works on loaded set
- Amount matching: numeric fuzzy (formatted "1,234.56" + startsWith + includes + split)

### ❌ Missing
- Server-side search (LIKE / FTS5) — currently client-side only, performance limit ที่ loaded page size
- Search by date range (transactions page มี date filter แยก)
- Search across categories / persons / properties

---

# 11. Notifications

**Status: ❌ Missing (Schema-Ready)**

### ❌ ไม่มีอะไรเลย
- ❌ ไม่มี notification system
- ❌ ไม่มี email notification
- ❌ ไม่มี push notification
- ❌ ไม่มี LINE Notify integration (schema มี `lineAccounts.notifyEnabled` แต่ไม่มี logic)
- ❌ ไม่มี in-app notification bell

### Schema-Ready (Dormant V2)
- `lineAccounts` table มี: userId, lineUserId, displayName, pictureUrl, notifyEnabled
- ไม่มี code ใช้งาน table นี้
- ไม่มี webhook / OAuth flow สำหรับ LINE Login

---

# 12. Settings

**Status: ⚠️ Partial (Minimal)**

**File**: `src/app/settings/page.tsx`

### ✅ มีอะไรแล้ว
- Link ไป `/admin/reconcile` (ตรวจสอบยอดบัญชี)
- Share Report page link (ผ่าน /more)
- Placeholder UI "ส่วนนี้จะพร้อมใช้งานในระยะถัดไป"

### ❌ Missing
- ❌ Change password
- ❌ Edit profile (name/email)
- ❌ Theme toggle (dark mode)
- ❌ Language switcher
- ❌ Notification preferences
- ❌ Date format / Currency format settings
- ❌ Export all data
- ❌ Delete account

---

# 13. Authentication

**Status: ✅ Complete**

**Files**: `src/lib/auth.ts` + `src/app/api/auth/[...all]/route.ts` + `src/app/api/setup/admin/route.ts` + `src/middleware.ts`

### ✅ มีอะไรแล้ว
- **Better Auth** library integration
- Email + Password authentication
- 30-day session, 1-day refresh
- HttpOnly cookies (secure in production)
- Middleware route protection (redirect to /login if no session)
- `callbackUrl` parameter for post-login redirect
- **First-admin setup** endpoint with rate limiting:
  - 5 attempts / 15 min window
  - 30 min lockout
  - `x-admin-setup-token` header required
  - 409 if admin already exists
- Role-based access control: `admin` / `viewer` enum

### ❌ Missing
- ❌ OAuth providers (Google / LINE / Apple) — Better Auth supports, not configured
- ❌ Password reset flow
- ❌ Email verification (Better Auth supports, not configured)
- ❌ 2FA / TOTP
- ❌ Multi-user shared access — schema มีแค่ 1 admin + viewers; viewers ไม่มี isolation
- ❌ Session management UI (list active sessions, revoke)
- ❌ "Remember me" option
- ❌ Login attempt rate limiting (มีแค่ setup endpoint)

---

# 14. Admin / Reconciliation

**Status: ✅ Complete**

**Files**: `src/app/admin/reconcile/page.tsx` + `src/app/api/admin/reconcile/route.ts` + `src/app/api/admin/reconcile/accounts/[id]/analysis/route.ts` + `src/app/api/admin/reconcile/accounts/[id]/repair/route.ts` + `src/app/api/admin/reconcile/accounts/[id]/transactions/route.ts` + `src/lib/reconciliation.ts`

### ✅ มีอะไรแล้ว
- Run reconciliation across all accounts (admin-gated)
- Compare `storedBalance` vs `expectedBalance` (computed from transactions)
- Severity classification: low / medium / high
- Possible cause detection:
  - pending_inconsistency
  - historical_bug
  - deleted_tx_inconsistency
  - adjustment_inconsistency
  - unknown
- Transaction history drill-down per account
- **Repair balance** (admin only) — sets storedBalance = expectedBalance
- Audit log entry on repair (`activity_logs` table)
- Visual confirmation + logId shown after repair

---

# 15. Audit Log

**Status: ⚠️ Partial**

**File**: `src/db/schema.ts` → `activity_logs` table

### ✅ มีอะไรแล้ว
- Schema: id, userId, action (CREATE/UPDATE/DELETE/RESTORE/RECONCILE), entity, entityId, oldValue, newValue, createdAt
- Index on `(entity, entityId)` for fast lookup
- ใช้ใน repair operation เท่านั้น

### ❌ Missing
- ❌ ไม่มี UI แสดง activity logs
- ❌ ไม่มี auto-log สำหรับ CREATE/UPDATE/DELETE ของ transactions/accounts/categories/persons/properties
- ❌ ไม่มี API ดึง logs

---

# 16. Cloudflare

**Status: ✅ Complete (Deployment)**

**Files**: `wrangler.toml` + `src/lib/cloudflare.ts`

### ✅ มีอะไรแล้ว
- **D1 Database** binding (`DB`)
  - Production DB ID: `d53cb4c2-8150-4fff-852f-7aa3390ffe2c`
  - Test DB ID: `811d6580-9cfc-46e2-a18b-2f50f37949f9`
  - migrations_dir: `drizzle/migrations`
- **R2 Bucket** binding (`BUCKET`)
  - Production: `smart-family-attachments`
  - Test env: same bucket name
- **OpenNext Cloudflare** build pipeline
- **nodejs_compat** flag
- Multiple environments: production + test
- `getD1()` + `getR2()` helpers via Cloudflare context symbol

### Deployment Pipeline
- `npm run build:cloudflare` → builds via OpenNext
- `npm run deploy` → build + deploy
- `npm run db:migrate:local` / `db:migrate:remote` for migrations
- `npm run db:seed-admin` for seeding admin user

### ❌ Missing
- ❌ KV / Durable Objects (ไม่ใช้)
- ❌ Cloudflare Analytics integration
- ❌ Custom domain configuration ใน wrangler.toml (ใช้ default)
- ❌ Cron triggers (ไม่มี scheduled jobs)

---

# 17. Database

**Status: ✅ Complete (Schema) + ⚠️ Partial (Cleanup)**

**File**: `src/db/schema.ts` (385 lines)

### ✅ 12 Tables
| # | Table | Status | Notes |
|---|-------|--------|-------|
| 1 | `users` | ✅ Active | role: admin/viewer |
| 2 | `auth_sessions` | ✅ Active | 30-day expiry |
| 3 | `auth_accounts` | ✅ Active | better-auth |
| 4 | `auth_verifications` | ✅ Active | better-auth |
| 5 | `persons` | ✅ Active | relationship enum |
| 6 | `properties` | ✅ Active | active/inactive |
| 7 | `accounts` | ✅ Active | business/personal flag |
| 8 | `categories` | ✅ Active | icon/color, isActive |
| 9 | `transaction_statuses` | ✅ Active | extensible |
| 10 | `transactions` | ✅ Active | 4 types, status enum |
| 11 | `attachments` | ✅ Active | fileKey for R2 |
| 12 | `activity_logs` | ⚠️ Partial | schema มี แต่ใช้แค่ใน reconcile repair |

### Dormant V2 Tables (Schema exists, no code uses)
| Table | Notes |
|-------|-------|
| `recurring_schedules` | frequency: daily/weekly/monthly/yearly, status: active/paused/terminated |
| `budgets` | categoryId + propertyId + amount + month + year |
| `ocr_results` | attachmentId + rawPayload + detectedAmount/Date + confidenceScore |
| `lineAccounts` | userId + lineUserId + notifyEnabled |

### Soft Delete Pattern
- ทุก entity มี `deletedAt` column + index
- ทุก query filter `isNull(deletedAt)` ผ่าน Drizzle helpers

### Migrations
- Drizzle Kit (`drizzle-kit generate`)
- `drizzle/migrations` directory (auto-generated)
- Local + Remote migration scripts

### ⚠️ Technical Debt (P7)
- **P7 Database Cleanup**: `attachments.uploaded_by_user_id` อ้างใน Roadmap แต่ schema ปัจจุบันไม่มี field นี้ ⇒ อาจ cleanup ไปแล้วใน code แต่ยังอยู่ใน Production DB
- Dormant tables เพิ่ม schema complexity โดยไม่มี usage

---

# 📊 Roadmap Validation

**Roadmap Reference**: `docs/SESSION_LOG.md` (P1-P7 from 2026-09-19)

| Item | Roadmap Priority | Source Code Status | Verdict |
|------|-----------------|---------------------|---------|
| **P1 Splash Screen** | ⭐⭐⭐⭐⭐ Ready | ❌ ไม่มี — ไม่มี loading screen component, ไม่มี `app/(loading)/` route | 🟡 **STILL TODO** |
| **P2 Account Detail Redesign** | ⭐⭐⭐⭐⭐ Ready | ❌ ยังใช้ layout เดิม (responsive cards แน่นเมื่อยอดเยอะ) | 🟡 **STILL TODO** |
| **P3 Date Filters** | ⭐⭐⭐⭐⭐ Ready | ✅ **DONE** — `today / 7days / 30days / month / custom / all` ใน transactions + accounts | 🟢 **DONE** (ลบจาก Roadmap ได้) |
| **P4 Search Improvements** | ⭐⭐⭐⭐⭐ Ready | ✅ **DONE** — search by title/note/category/account names + amount numeric | 🟢 **DONE** (ลบจาก Roadmap ได้) |
| **P5 Payment Reminder System** | ⭐⭐⭐⭐ Ready | ⚠️ **PARTIAL** — deadline logic มี (Bangkok 18:00) แต่ไม่มี configurable 1/3/7/14/30 วัน, ไม่มี notification | 🟡 **PARTIAL DONE** |
| **P6 Attachment Thumbnail System** | ⭐⭐⭐⭐ Ready | ⚠️ **PARTIAL** — มี preview (128px Q30) ตอน upload, แต่ไม่มี thumb tier แยก + ยังโหลด original ใน lightbox | 🟡 **PARTIAL DONE** |
| **P7 Database Cleanup** | ⭐⭐ Not urgent | ⚠️ Schema code ไม่มี `uploaded_by_user_id` แล้ว แต่อาจยังอยู่ใน Prod DB (ต้อง verify) | 🟡 **NEEDS VERIFY** |

### Summary

| Category | Items |
|----------|-------|
| **ทำเสร็จแล้ว (ลบจาก Roadmap ได้)** | P3 Date Filters, P4 Search Improvements |
| **ทำบางส่วน (อาจปรับ Roadmap)** | P5 Payment Reminder, P6 Thumbnail, P7 DB Cleanup |
| **ยังไม่ทำ (เก็บใน Roadmap)** | P1 Splash Screen, P2 Account Detail Redesign |
| **ไม่อยู่ใน Roadmap แต่เสร็จแล้ว** | Lightbox viewer, Streaming R2, Parallel Upload, Account Ledger V1, Attachments hard-delete policy, Reconciliation tool |

---

# 🐛 Technical Debt Summary

| Debt | Severity | Impact |
|------|----------|--------|
| **Debug code in SESSION_LOG commented-out** | Low | Dashboard `_components/person-accordion-card.tsx` (need to verify) — but main dashboard already clean |
| **Dashboard month hardcoded** | Low | ไม่มี date picker บน Dashboard (ต้องไป /transactions filter) |
| **Audit logs ไม่ครอบคลุม CRUD อื่น** | Medium | มีแค่ repair operation — transactions/accounts/categories edits ไม่ได้ log |
| **Dormant V2 tables** | Low | `recurring_schedules`, `budgets`, `ocr_results`, `lineAccounts` schema-only — เพิ่ม complexity |
| **`/api/attachments/[id]/image` ไม่ auth-check** | Medium | Public endpoint — auth check ทำที่ page level (per comment) |
| **No request-level rate limiting** (except setup) | Medium | ไม่มี global rate limit |
| **No CSRF protection** | Medium | ใช้ sameSite=lax cookies เท่านั้น |
| **No automated tests** สำหรับ UI/API | High | มีแค่ `src/lib/__tests__/` (3 files: refactor-parity, transaction-balance x2) |
| **In-memory rate limiter** (`api/setup/admin`) | Low | ใช้ Map ใน memory — หายเมื่อ Worker cold start |
| **Search client-side only** | Low | Performance limit ที่ loaded transactions page |
| **Comments referencing old schema** (`transactions_old`) | Low | อาจมีใน SESSION_LOG/comments |

---

# 🗂️ Feature Inventory by Status

## ✅ Complete (42 items)
- Dashboard (8 features)
- Transactions CRUD (5)
- Transactions filters (9)
- Accounts CRUD + Ledger (5)
- Categories CRUD (5)
- Persons CRUD (3)
- Properties CRUD (4)
- Attachments (upload, retrieve, delete, lightbox, streaming) (5)
- Pending/Overdue detection (4)
- Reports (PNG + LINE share) (4)
- Auth (email/password) (4)
- Admin Reconcile (4)
- Cloudflare deployment (4)
- Search (transactions + accounts) (2)

## ⚠️ Partial (8 items)
- P5 Payment Reminder (deadline logic only)
- P6 Attachment Thumbnail (preview only, no thumb tier)
- P7 DB Cleanup (need verify Prod)
- Audit Logs (repair-only)
- Settings page (minimal)
- Dashboard month hardcoded
- Search server-side (no FTS5)
- Activity Logs UI (missing)

## ❌ Missing (24+ items)
- Recurring transactions
- Budgets (schema exists, no UI)
- OCR (schema exists, no logic)
- LINE Integration (schema exists, no OAuth/webhook)
- Notifications (email, push, in-app)
- P1 Splash Screen
- P2 Account Detail Redesign
- CSV/Excel import/export
- Charts/Graphs
- Multi-user data isolation
- Password reset / email verification
- OAuth (Google/Apple/LINE)
- 2FA
- Theme toggle / Dark mode
- Language switcher
- Bulk operations
- Property/Category hierarchy
- Multi-month comparison
- Dashboard date picker
- Global search (Cmd+K)
- Auto-send scheduled reports

---

# 📁 File Map

```
src/
├── app/
│   ├── (auth)/login/                  # Login page
│   ├── accounts/
│   │   ├── page.tsx                   # Account list
│   │   └── [id]/page.tsx              # Account ledger
│   ├── admin/reconcile/page.tsx       # Admin reconciliation
│   ├── api/                           # 23 API routes
│   │   ├── accounts/                  # CRUD + usage
│   │   ├── admin/reconcile/           # 4 sub-routes
│   │   ├── attachments/               # upload, retrieve, delete
│   │   ├── auth/[...all]/             # better-auth handler
│   │   ├── categories/                # CRUD + usage
│   │   ├── persons/                   # CRUD + usage
│   │   ├── properties/                # CRUD + usage
│   │   ├── setup/admin/               # first-admin bootstrap
│   │   └── transactions/              # CRUD + received
│   ├── categories/page.tsx
│   ├── dashboard/page.tsx             # + _components/
│   ├── more/page.tsx                  # More menu
│   ├── persons/page.tsx
│   ├── properties/page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   └── share-report/page.tsx
│   └── transactions/page.tsx          # Main ledger
├── components/
│   ├── mobile-nav.tsx
│   ├── desktop-sidebar.tsx
│   ├── category-icon.tsx
│   ├── color-picker.tsx
│   ├── icon-picker.tsx
│   ├── shareable-report.tsx
│   ├── sign-out-button.tsx
│   ├── global-error-logger.tsx
│   └── ui/
│       ├── attachment-manager.tsx
│       ├── attachment-picker.tsx
│       └── toast.tsx
├── lib/
│   ├── api-auth.ts                    # auth + error helpers
│   ├── auth.ts                        # better-auth setup
│   ├── auth-client.ts
│   ├── cloudflare.ts                  # D1 + R2 helpers
│   ├── constants.ts
│   ├── image-compression.ts           # browser compression
│   ├── reconciliation.ts              # balance math
│   ├── report.ts                      # LINE report builder
│   ├── transaction-balance.ts         # balance impact math
│   ├── utils.ts                       # date/account formatters
│   ├── validation.ts                  # zod schemas
│   └── __tests__/                     # 3 test files
├── db/
│   ├── schema.ts                      # 12 tables
│   └── client.ts
├── middleware.ts                      # auth route guard
├── types/
│   ├── index.ts                       # ActivityLog type
│   └── session.ts
└── ...
```

---

# 🔧 Verification Commands

```bash
# Build verification
npm run build
npm run build:cloudflare

# Deploy
npm run deploy

# Database
npm run db:generate
npm run db:migrate:local
npm run db:migrate:remote
npm run db:seed-admin

# Tests
npx vitest
```

---

**Last Updated**: 2026-09-22
**Source Commit**: `6d9482b1`
**Scan Mode**: Read-only — no code changes during audit
