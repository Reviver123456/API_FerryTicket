# API_FerryTicket

โปรเจกต์นี้เป็น Backend แบบ Full System สำหรับระบบจองตั๋วเรือ โดยใช้:
- Node.js + Express
- Supabase (Postgres)
- Supabase Auth
- QR E-Ticket
- Booking Draft / Hold Seat
- Payment Mock Webhook
- Notification Log

## ฟีเจอร์หลัก
- สมัครสมาชิก / login ด้วย auth ชุดเดียว
- ลืมรหัสผ่าน / reset password
- อัปโหลดรูปโปรไฟล์
- ระบบ users / roles / permissions แบบรวม
- ค้นหารอบเรือ
- สร้าง booking draft
- บันทึกข้อมูลผู้จองและผู้โดยสารผ่าน booking + passengers
- สร้าง payment transaction
- รับ webhook จาก payment gateway
- ออกตั๋วและ QR code อัตโนมัติเมื่อจ่ายสำเร็จ
- ดูรายการ booking / payment / ticket แบบใช้สิทธิ์จาก role
- Dashboard / reports / POS / agents / settings
- Notifications ผ่าน user API และ internal API

## โครงสร้างโปรเจกต์
```
src/
  config/
  controllers/
  middleware/
  routes/
  services/
  utils/
supabase/
  schema.sql
```

## การติดตั้ง
```bash
npm install
cp .env.example .env
npm run dev
```

## ตั้งค่า Supabase
1. สร้างโปรเจกต์ใน Supabase
2. เปิด SQL Editor
3. วางไฟล์ `supabase/schema.sql`
4. เปิดใช้งาน Supabase Auth
5. นำค่าเหล่านี้มาใส่ใน `.env`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` หรือ `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY` (recommended)
   - `PAYMENT_WEBHOOK_SECRET`
   - `INTERNAL_API_KEY`
   - `PASSWORD_RESET_URL` (optional)
   - `PASSWORD_RESET_EXPIRES_MINUTES` (optional)
   - `PROFILE_IMAGE_BUCKET` (optional)
   - `PROFILE_IMAGE_MAX_BYTES` (optional)
   - `BOOKING_HOLD_MINUTES` (optional)
   - `BOOKING_EXPIRY_JOB_ENABLED` (optional)
   - `BOOKING_EXPIRY_JOB_INTERVAL_MS` (optional)

## สำหรับ Production
- password local แบบเดิมจะถูก hash ด้วย `scrypt` ระหว่างช่วง migrate
- ทุก user type จะออก `token` จาก Supabase Auth ชุดเดียว
- route ภายในต้องส่ง `x-internal-api-key`
- payment webhook ต้องส่ง `x-webhook-secret`
- CORS จะใช้ allowlist จาก `CORS_ORIGINS`
- มี rate limit พื้นฐานสำหรับทั้งระบบและ route auth
- มี `GET /health` สำหรับ health check
- มี `GET /docs` และ `GET /docs/openapi.json` สำหรับ Swagger / OpenAPI
- มี background job สำหรับ expire booking draft อัตโนมัติ
- forgot password จะคืน `debug.reset_token` และ `debug.reset_url` เฉพาะตอนที่ `NODE_ENV` ไม่ใช่ production
- profile image จะถูกอัปโหลดเข้า Supabase Storage bucket แบบ public อัตโนมัติเมื่อมีการใช้งานครั้งแรก

## Smoke Test
หลังจากตั้งค่า `.env` และรัน API แล้ว สามารถตรวจ flow หลักแบบ end-to-end ได้ด้วย

```bash
npm run smoke
```

## ตัวอย่าง API

### 1) Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Biza",
    "last_name": "Demo",
    "phone": "0812345678",
    "email": "biza@example.com",
    "password": "12345678"
  }'
```

### 2) Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "biza@example.com",
    "password": "123456"
  }'
```

response จะคืน `token`, `refresh_token` และ `session` จาก Supabase Auth

### 3) Get schedules
```bash
curl http://localhost:3000/api/schedules
```

### 3.1) Forgot password
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "biza@example.com"
  }'
```

### 3.2) Reset password
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN_FROM_FORGOT_PASSWORD",
    "new_password": "ProdReady123!"
  }'
```

### 3.3) Upload profile image
```bash
curl -X POST http://localhost:3000/api/auth/me/profile-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "image_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }'
```

### 4) Get ticket types
```bash
curl http://localhost:3000/api/ticket-types
```

### 5) Create booking draft
```bash
curl -X POST http://localhost:3000/api/bookings/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "schedule_id": "SCHEDULE_UUID",
    "items": [
      {
        "ticket_type_id": "TICKET_TYPE_UUID",
        "quantity": 2
      }
    ]
  }'
```

ถ้าส่ง `Authorization: Bearer YOUR_ACCESS_TOKEN` มาด้วย ระบบจะบันทึก `user_id` ลง booking ให้โดยอัตโนมัติ
ถ้าไม่ส่ง token ระบบยังอนุญาตให้จองแบบ guest ได้ และ `user_id` จะเป็น `NULL`

## Swagger / OpenAPI
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs/openapi.json`

### 6) Update booking info
```bash
curl -X PUT http://localhost:3000/api/bookings/BKXXXXXXXXXX \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "contact_name": "Biza Demo",
    "contact_phone": "0812345678",
    "contact_email": "biza@example.com"
  }'
```

### 7) Update booking passengers
```bash
curl -X PUT http://localhost:3000/api/bookings/BKXXXXXXXXXX/passengers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "passengers": [
      { "full_name": "Passenger 1", "passenger_type": "adult" },
      { "full_name": "Passenger 2", "passenger_type": "adult" }
    ]
  }'
```

### 8) Create payment
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "booking_no": "BKXXXXXXXXXX",
    "contact_email": "biza@example.com",
    "payment_method": "qr_promptpay"
  }'
```

### 9) Mock payment webhook success
```bash
curl -X POST http://localhost:3000/api/payments/webhook/callback \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${PAYMENT_WEBHOOK_SECRET}" \
  -d '{
    "payment_ref": "PAYXXXXXXXXXX",
    "status": "success",
    "transaction_id": "TXN-0001",
    "amount": 240
  }'
```

### 10) Get tickets by booking
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "http://localhost:3000/api/tickets?bookingNo=BKXXXXXXXXXX"
```

### 11) List my bookings
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "http://localhost:3000/api/bookings"
```

## API Surface หลัก

- `GET /`
- `GET /health`
- `GET /docs`
- `GET /docs/openapi.json`
- `POST|GET|PUT /api/auth/*`
- `GET|POST|PUT /api/roles`
- `GET /api/permissions`
- `GET|POST|PUT /api/ticket-types`
- `GET|POST|PUT /api/schedules`
- `POST /api/schedules/:id/open-sales`
- `POST /api/schedules/:id/close-sales`
- `POST /api/schedules/:id/cancel`
- `GET|POST|PUT /api/prices`
- `GET /api/prices/preview`
- `prices.day_type` รองรับ `all | weekday | weekend | holiday`
- ตาราง `holiday_calendar` ใช้ระบุวันนักขัตฤกษ์สำหรับการคำนวณราคา
- `POST /api/bookings/draft`
- `GET|PUT /api/bookings/:bookingNo`
- `GET|PUT /api/bookings/:bookingNo/passengers`
- `POST /api/bookings/:bookingNo/cancel`
- `POST /api/bookings/:bookingNo/change-schedule`
- `POST /api/bookings/:bookingNo/mark-paid`
- `POST /api/bookings/:bookingNo/resend-tickets`
- `POST /api/bookings/:bookingNo/refund`
- `POST /api/bookings/jobs/expire-stale`
- `POST|GET /api/payments`
- `GET /api/payments/:paymentRef`
- `POST /api/payments/:paymentRef/confirm`
- `POST /api/payments/:paymentRef/refund`
- `POST /api/payments/webhook/callback`
- `GET /api/tickets`
- `GET /api/tickets/:ticketNo`
- `POST /api/tickets/resend`
- `GET|POST /api/notifications`
- `POST /api/notifications/:id/read`
- `GET /api/dashboard`
- `GET /api/reports/sales`
- `GET /api/reports/passengers`
- `POST|GET /api/pos/sales`
- `GET /api/pos/sales/:id`
- `GET|POST|PUT /api/agents`
- `GET /api/agents/:id/sales`
- `GET|PUT /api/settings`
- `GET /api/settings/export`
- `POST /api/settings/import`
- `GET|POST /api/users`
- `GET|PUT /api/users/:id`
- `POST /api/users/:id/reset-password`

ตัวอย่าง login ผู้ใช้ที่มีสิทธิ์ admin/staff:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123456"
  }'
```

ตัวอย่างสร้างรอบเรือ:

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{
    "trip_date": "2026-04-01",
    "departure_time": "09:00",
    "arrival_time": "10:30",
    "route_name": "Main Pier - Island Pier",
    "origin_port": "Main Pier",
    "destination_port": "Island Pier",
    "capacity": 120,
    "status": "open"
  }'
```

ตัวอย่างขายตั๋ว Walk-in:

```bash
curl -X POST http://localhost:3000/api/pos/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{
    "schedule_id": "SCHEDULE_UUID",
    "contact_name": "Walk-in Customer",
    "contact_email": "walkin@example.com",
    "contact_phone": "0812345678",
    "payment_method": "cash",
    "items": [
      {
        "ticket_type_id": "TICKET_TYPE_UUID",
        "quantity": 2
      }
    ],
    "passengers": [
      { "full_name": "Passenger 1", "passenger_type": "adult" },
      { "full_name": "Passenger 2", "passenger_type": "adult" }
    ]
  }'
```

## สถานะหลักในระบบ
### Booking Status
- `draft`
- `pending_payment`
- `confirmed`
- `expired`
- `cancelled`

### Payment Status
- `pending`
- `success`
- `failed`
- `refunded`

### Ticket Status
- `unused`
- `used`
- `cancelled`
- `refunded`

## ข้อควรรู้
- เวอร์ชันนี้เป็น Full System สำหรับเริ่มต้นใช้งานและต่อยอดจริงได้
- Payment Gateway ยังเป็น mock webhook เพื่อให้เชื่อมของจริงต่อได้ง่าย
- route ภายในควรใช้ `INTERNAL_API_KEY` ผ่าน API Gateway หรือ private network
- ควรเปิดใช้ Supabase RLS และ policy เพิ่มเมื่อมี frontend หรือ service อื่นใช้ `anon/publishable key`
- account local เดิมจะถูก migrate เข้า Supabase Auth ตอน login หรือ reset password ครั้งถัดไปอัตโนมัติ

## สิ่งที่แนะนำให้ทำต่อ
- ต่อ frontend React / Next.js
- เชื่อม PromptPay / Omise / 2C2P / GB Prime Pay
- เพิ่ม unit test และ integration test
