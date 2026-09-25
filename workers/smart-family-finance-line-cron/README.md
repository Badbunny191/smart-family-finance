# Smart Family Finance - LINE Cron Worker

Worker สำหรับส่ง LINE notification อัตโนมัติทุกวัน

## 📋 ภาพรวม

| Property | Value |
|----------|-------|
| Worker Name | `smart-family-finance-line-cron` |
| Trigger | Cron (every minute) |
| Runtime | Cloudflare Workers |

## 🎯 ทำหน้าที่อะไร

Worker นี้ทำหน้าที่:

1. **ตรวจสอบเวลา** - ทุก 1 นาที ดูว่าเป็นเวลาที่ user ตั้งค่าไว้หรือไม่
2. **ดึงข้อมูล Metrics** - ยอดคงเหลือ, รายรับ, รายจ่าย, ค้างรับ, เกินกำหนด
3. **ส่ง LINE Flex Message** - ส่ง summary รายวันในรูปแบบ Flex Message
4. **Deduplication** - ป้องกันส่งซ้ำในวันเดียวกัน

## ⏰ Cron Schedule

```
* * * * *   (ทุก 1 นาที)
```

Worker จะทำงานทุก 1 นาที แต่จะส่ง message เฉพาะเมื่อ:
- เวลาปัจจุบัน (Asia/Bangkok) ตรงกับ `sendTime` ที่ user ตั้งค่าไว้
- ยังไม่เคยส่งในวันนี้ (dedup by `last_sent_at`)

## 🔗 Bindings

### D1 Database

| Binding | Database Name | Database ID |
|---------|---------------|-------------|
| `DB` | smart-family-finance-db | `d53cb4c2-8150-4fff-852f-7aa3390ffe2c` |

### Secrets (ต้องตั้งผ่าน CLI)

```bash
# ตั้งค่า LINE Channel Access Token
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
```

## 🗄️ Database Tables ที่ใช้

| Table | Purpose |
|-------|---------|
| `accounts` | ดึงยอดคงเหลือ (current_balance) |
| `transactions` | ดึงรายรับ/รายจ่าย, pending, overdue |
| `line_accounts` | ดึง LINE user ที่เปิด notify |
| `notification_settings` | ดึง per-user settings และ last_sent_at |

## 📊 Per-User Settings

แต่ละ user สามารถตั้งค่าได้:

```json
{
  "sendTime": "08:00",
  "showBalance": true,
  "showIncome": true,
  "showExpense": true,
  "showPending": true,
  "showOverdue": true,
  "showPendingDetails": true,
  "showOverdueDetails": true
}
```

## 🚀 วิธี Deploy

### 1. เตรียม Secrets

```bash
# ไปที่ worker directory
cd workers/smart-family-finance-line-cron

# ตั้งค่า LINE Channel Access Token
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# พิมพ์ LINE Channel Access Token แล้วกด Enter
```

### 2. Deploy

```bash
# Deploy ไป production
npx wrangler deploy

# หรือ deploy ไป staging
npx wrangler deploy --env staging
```

### 3. ตรวจสอบ

```bash
# ดู logs
npx wrangler tail

# ดู deployment info
npx wrangler deployments list
```

## 🌐 Endpoints

Worker มี HTTP endpoints สำหรับตรวจสอบ:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check - ตรวจสอบว่า worker ทำงาน |
| `/info` | GET | ดูข้อมูล metrics และ current time |

## 📁 โครงสร้างไฟล์

```
workers/smart-family-finance-line-cron/
├── src/
│   └── index.ts          # Worker code (เหมือนกับ src/workers/line-cron-worker/index.ts)
├── wrangler.toml         # Worker configuration
└── README.md            # ไฟล์นี้
```

## 🔧 Local Development

```bash
cd workers/smart-family-finance-line-cron

# Start dev server
npx wrangler dev

# Test locally
curl http://localhost:8787/health
curl http://localhost:8787/info
```

## ⚠️ Important Notes

1. **Timezone**: ทุกการคำนวณใช้ `Asia/Bangkok` timezone (UTC+7)
2. **Deduplication**: ใช้ `last_sent_at` เพื่อป้องกันส่งซ้ำในวันเดียวกัน
3. **Fallback**: ถ้า user ไม่มี settings จะใช้ default `sendTime: "08:00"`
4. **Metrics**: ดึงข้อมูลจาก D1 database โดยตรง (ไม่ผ่าน API)

## 🗑️ Cleanup (ถ้าต้องการลบ Worker จาก Cloudflare)

```bash
cd workers/smart-family-finance-line-cron

# ลบ worker
npx wrangler delete smart-family-finance-line-cron
```

## 📞 Support

ถ้ามีปัญหา ดู logs ที่:

1. Cloudflare Dashboard > Workers & Pages > smart-family-finance-line-cron > Logs
2. หรือใช้ `npx wrangler tail`
