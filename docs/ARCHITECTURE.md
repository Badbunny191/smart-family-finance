# ARCHITECTURE: Smart Family Finance

## Folder Structure
smart-family-finance/
├── .env.example
├── .gitignore
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUSINESS_RULES.md
│   ├── KNOWN_ISSUES.md
│   ├── PHASE6C_BACKLOG.md
│   ├── PROJECT_MEMORY.md
│   └── business-rules.md
├── drizzle.config.ts
├── drizzle/
│   └── migrations/
│       ├── 0000_smart_family_finance_v1_final.sql
│       ├── 0001_better_auth_tables.sql
│       ├── 0002_categories_business_status.sql
│       └── 0003_account_metadata.sql
├── hash-password.mjs
├── next-env.d.ts
├── next.config.ts
├── open-next.config.ts
├── package.json
├── postcss.config.js
├── scripts/
│   └── seed-admin.mjs
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── accounts/
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── accounts/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── auth/
│   │   │   │   └── [...all]/
│   │   │   │       └── route.ts
│   │   │   ├── categories/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── persons/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── properties/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── setup/
│   │   │   │   └── admin/
│   │   │   │       └── route.ts
│   │   │   └── transactions/
│   │   │       ├── [id]/
│   │   │       │   ├── received/
│   │   │       │   │   └── route.ts
│   │   │       │   └── route.ts
│   │   │       └── route.ts
│   │   ├── categories/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── error.tsx
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── more/
│   │   │   └── page.tsx
│   │   ├── page.tsx
│   │   ├── persons/
│   │   │   └── page.tsx
│   │   ├── properties/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── transactions/
│   │       └── page.tsx
│   ├── components/
│   │   ├── mobile-nav.tsx
│   │   └── sign-out-button.tsx
│   ├── db/
│   │   ├── client.ts
│   │   └── schema.ts
│   ├── lib/
│   │   ├── api-auth.ts
│   │   ├── auth-client.ts
│   │   ├── auth.ts
│   │   ├── cloudflare.ts
│   │   ├── dashboard-data.ts
│   │   ├── utils.ts
│   │   └── validation.ts
│   ├── middleware.ts
│   └── types/
│       └── index.ts
├── tailwind.config.js
├── tsconfig.json
└── wrangler.toml

## Data Flow
1. **Client Request**: ผู้ใช้เปิดหน้าเว็บผ่านเบราว์เซอร์บนมือถือหรือเดสก์ท็อป
2. **Edge Authentication & Middleware**:
   - `src/middleware.ts` ตรวจสอบสถานะการ Login ของ Session
   - ถ้าไม่มีสิทธิ์ จะ Redirect ไปยัง `/login`
3. **Navigation & Presentation**:
   - หน้าจอหลักถูกครอบด้วย Layout และ Bottom Nav ใน `src/components/mobile-nav.tsx` แบ่งเป็น 4 แท็บหลัก (Dashboard, Transactions, Accounts, More)
   - ข้อมูลหน้า Dashboard คำนวณผ่าน `src/lib/dashboard-data.ts`
4. **API & Data Processing**:
   - หน้าบ้านเรียก Fetch ไปยัง Next.js Route Handlers (`src/app/api/...`)
   - ตรวจสอบ Session ฝั่ง API ผ่าน `src/lib/api-auth.ts`
   - ตรวจสอบ Schema ของ Body/Params ผ่าน `src/lib/validation.ts`
5. **Database Interaction**:
   - ใช้งาน Drizzle ORM (`src/db/client.ts`) ผ่าน Cloudflare D1 Binding (`src/lib/cloudflare.ts`)
   - ดำเนินการ Query ตาม Schema ใน `src/db/schema.ts` และส่ง Response กลับเป็น JSON

## API Structure
| Entity | Route Endpoint | Methods | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/[...all]` | ALL | จัดการ Login, Session, Verify ผ่าน Better Auth |
| **Admin Setup** | `/api/setup/admin` | POST | สร้าง Admin เริ่มต้นของระบบ |
| **Accounts** | `/api/accounts` | GET, POST | ดึงรายการบัญชี / สร้างบัญชีการเงินใหม่ |
| | `/api/accounts/[id]` | GET, PUT/PATCH, DELETE | อ่าน / แก้ไข / ลบบัญชีตาม ID |
| **Transactions** | `/api/transactions` | GET, POST | ดึงรายการธุรกรรม / สร้างธุรกรรมใหม่ |
| | `/api/transactions/[id]` | GET, PUT/PATCH, DELETE | อ่าน / แก้ไข / ลบธุรกรรมตาม ID |
| | `/api/transactions/[id]/received`| POST/PATCH | อัปเดตสถานะการได้รับเงิน / เคลียร์ยอด |
| **Categories** | `/api/categories` | GET, POST | ดึงรายการหมวดหมู่ / สร้างหมวดหมู่ใหม่ |
| | `/api/categories/[id]` | GET, PUT/PATCH, DELETE | อ่าน / แก้ไข / ลบหมวดหมู่ตาม ID |
| **Persons** | `/api/persons` | GET, POST | ดึงรายชื่อบุคคล / บันทึกข้อมูลบุคคลใหม่ |
| | `/api/persons/[id]` | GET, PUT/PATCH, DELETE | อ่าน / แก้ไข / ลบข้อมูลบุคคลตาม ID |
| **Properties** | `/api/properties` | GET, POST | ดึงรายการทรัพย์สิน / สร้างข้อมูลทรัพย์สินใหม่ |
| | `/api/properties/[id]` | GET, PUT/PATCH, DELETE | อ่าน / แก้ไข / ลบข้อมูลทรัพย์สินตาม ID |

## Database Structure
- **Storage**: Cloudflare D1
- **Driver / ORM**: Drizzle ORM (`src/db/schema.ts`)
- **Migration History**:
  - `0000_smart_family_finance_v1_final.sql`: ตารางหลักเริ่มต้น (Accounts, Transactions, Categories, Persons, Properties)
  - `0001_better_auth_tables.sql`: ตารางระบบสมาชิก Better Auth
  - `0002_categories_business_status.sql`: เพิ่ม Business Status ใน Categories
  - `0003_account_metadata.sql`: เพิ่ม Metadata ใน Accounts
- **ข้อกำหนดเข้มงวด**: ห้ามแก้ Schema หรือรัน Drizzle Migration โดยไม่ได้รับอนุญาต

## Authentication Flow
1. เข้าใช้งานหน้า `/login`
2. ยืนยันตัวตนผ่าน Better Auth Handler ที่ `/api/auth/[...all]`
3. Client จัดการ Session ผ่าน `src/lib/auth-client.ts`
4. ป้องกัน Route ผ่าน `src/middleware.ts` และป้องกัน API Route ผ่าน `src/lib/api-auth.ts`
5. จัดการออกจากระบบผ่าน `src/components/sign-out-button.tsx`

## Key File Map
- **Navigation Components**: `src/components/mobile-nav.tsx`
- **Dashboard Modules**: `src/app/dashboard/page.tsx`, `src/lib/dashboard-data.ts`
- **Transactions Modules**: `src/app/transactions/page.tsx`, `src/app/api/transactions/`
- **Accounts Modules**: `src/app/accounts/page.tsx`, `src/app/api/accounts/`
- **Validation & Auth Logic**: `src/lib/validation.ts`, `src/lib/auth.ts`, `src/lib/api-auth.ts`
- **Database & Cloudflare Bindings**: `src/db/schema.ts`, `src/db/client.ts`, `src/lib/cloudflare.ts`