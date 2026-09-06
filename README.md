# Smart Family Finance

เอกสารนี้อธิบายการสร้าง admin user เริ่มต้นด้วย `scripts/seed-admin.mjs`

## ภาพรวม flow

`seed-admin.mjs` ไม่ได้เขียนฐานข้อมูลโดยตรง แต่ส่ง `POST` ไปที่ `/api/setup/admin` พร้อมข้อมูล admin และ header `x-admin-setup-token`

API จะทำงานตามลำดับดังนี้:

1. ตรวจสอบ `ADMIN_SETUP_TOKEN`
2. ตรวจว่ามี admin อยู่แล้วหรือไม่
3. เรียก Better Auth เพื่อสร้าง user และ password hash
4. เปลี่ยน role ของ user เป็น `admin`
5. ส่งผลลัพธ์กลับเป็น JSON

ถ้ามี admin อยู่แล้ว API จะตอบ `409` และจะไม่สร้าง user ซ้ำ

## 1. ตั้งค่า `.env.local`

คัดลอกไฟล์ตัวอย่างก่อน:

```bash
cp .env.example .env.local
```

ตั้งค่าอย่างน้อยดังนี้:

```dotenv
BETTER_AUTH_SECRET=ใช้ค่า secret แบบสุ่มที่ยาวและปลอดภัย
BETTER_AUTH_URL=https://โดเมนของแอป
NEXT_PUBLIC_APP_URL=https://โดเมนของแอป

# ใช้ป้องกัน endpoint สร้าง admin และควรใช้เพียงครั้งเดียว
ADMIN_SETUP_TOKEN=ตั้งค่าเป็น token ลับแบบสุ่ม

ADMIN_NAME=Family Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=รหัสผ่านอย่างน้อย 8 ตัวอักษร

# URL ที่ seed script จะยิง request ไปหา
APP_URL=https://โดเมนของแอป
```

`ADMIN_PASSWORD` ไม่ควรใช้ค่าเดียวกับ `ADMIN_SETUP_TOKEN` และห้าม commit `.env.local` เข้า git

## 2. Apply migration

ต้องสร้างตาราง Better Auth ก่อน seed admin:

```bash
npm install
npm run db:migrate:remote
```

คำสั่ง remote ต้องใช้หลังจากตั้งค่า `database_id` จริงใน `wrangler.toml` แล้วเท่านั้น ปัจจุบันค่าที่อยู่ในไฟล์เป็น placeholder

สำหรับทดสอบ schema กับ D1 local:

```bash
npm run db:migrate:local
```

## 3. ต้องเปิด dev server หรือไม่

`seed-admin.mjs` ต้องมี HTTP server ที่รับ request ได้ เพราะ script เรียก `/api/setup/admin` ผ่าน `fetch`

ดังนั้นต้องมีอย่างใดอย่างหนึ่ง:

- deployment ที่ทำงานอยู่บน Cloudflare
- local OpenNext worker ที่รองรับ Next.js และ D1 binding `DB`

ถ้าไม่มี server จะพบ error เช่น `fetch failed` หรือ `ECONNREFUSED`

## 4. ใช้ `wrangler dev` หรือ `npm run dev`

### Local authentication runtime

โปรเจกต์ใช้ OpenNext เพื่อผูก Next.js กับ Cloudflare D1 ดังนั้นให้ใช้ลำดับนี้:

```bash
npm run db:migrate:local
npm run build:cloudflare
npm run preview
```

`npm run preview` จะเปิด worker ที่ `http://localhost:8787` พร้อม D1 local binding จาก `wrangler.toml` จากนั้นเปิด terminal อีกหน้าต่างแล้วรัน:

```bash
npm run db:seed-admin
```

สำหรับแก้ UI อย่างเดียว ใช้ `npm run dev` ได้ แต่การทดสอบ auth ที่ต้องใช้ D1 ให้ใช้ `npm run preview` เป็นหลัก

### Production deployment

ใช้คำสั่งนี้หลังตั้งค่า Cloudflare account และ D1 database แล้ว:

```dotenv
APP_URL=https://โดเมนของแอป
```

```bash
npm run deploy
```

จากนั้นตั้ง `APP_URL` ให้ชี้ไปยัง URL deployment และรัน seed จากเครื่อง local:

```bash
npm run db:seed-admin
```

npm script จะโหลด `.env.local` ให้อัตโนมัติผ่าน `node --env-file=.env.local`

> การ seed จะสร้าง admin ใน D1 ที่ worker ของ `APP_URL` ใช้งานอยู่ ถ้า `APP_URL` เป็น production จะเขียนลง production database

## 5. ตรวจสอบว่า admin ถูกสร้างแล้ว

### ตรวจจากผลลัพธ์ของ seed

เมื่อสำเร็จจะเห็นข้อความลักษณะนี้:

```text
Admin user created: admin@example.com
```

ถ้ามี admin อยู่ก่อนแล้ว จะเห็นสถานะ `409` และข้อความ `An admin user already exists.` ซึ่งถือเป็นพฤติกรรมที่ตั้งใจไว้

### ตรวจจาก D1 โดยตรง

ตรวจ remote database:

```bash
npx wrangler d1 execute smart-family-finance-db \
  --remote \
  --command "SELECT id, name, email, role FROM users WHERE role = 'admin';"
```

ผลควรมี user หนึ่งรายการ และ `role` ต้องเป็น `admin`

### ตรวจจากหน้าเว็บ

1. เปิด `APP_URL/login`
2. ใช้ `ADMIN_EMAIL` และ `ADMIN_PASSWORD`
3. กดเข้าสู่ระบบ
4. ต้องถูกพาไปที่ `/dashboard`
5. dashboard ต้องแสดงชื่อและ email ของ admin
6. กด `ออกจากระบบ` แล้วต้องกลับไป `/login`

## คำสั่ง seed แบบเต็ม

```bash
npm run db:seed-admin
```

หรือรันโดยไม่ใช้ npm script:

```bash
node --env-file=.env.local scripts/seed-admin.mjs
```

## หลังสร้าง admin สำเร็จ

ควรทำสิ่งต่อไปนี้ทันที:

1. เปลี่ยนหรือลบ `ADMIN_SETUP_TOKEN` จาก environment
2. ตรวจว่า endpoint setup ไม่สามารถสร้าง admin ซ้ำได้
3. เก็บ `ADMIN_PASSWORD` ใน password manager
4. ห้าม commit `.env.local`

## การแก้ปัญหาเบื้องต้น

### `ADMIN_SETUP_TOKEN, ADMIN_EMAIL and ADMIN_PASSWORD are required.`

ตรวจว่าตัวแปรทั้งสามมีอยู่ใน `.env.local` และใช้คำสั่ง `npm run db:seed-admin` หรือ `node --env-file=.env.local ...`

### `ECONNREFUSED` หรือ `fetch failed`

`APP_URL` ไม่มี server ที่กำลังทำงาน หรือ URL ไม่ถูกต้อง

### `D1 binding DB is missing.`

ปลายทางที่ `APP_URL` ไม่ได้รันด้วย Cloudflare runtime ที่ผูก D1 binding ชื่อ `DB`

### `An admin user already exists.`

ระบบมี admin แล้ว ไม่จำเป็นต้อง seed ซ้ำ ให้ใช้ email/password ของ admin เดิม login
