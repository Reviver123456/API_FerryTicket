# API_FerryTicket

โปรเจกต์นี้เป็น Backend แบบ Full System สำหรับระบบจองตั๋วเรือ โดยใช้:
- Node.js + Express
- Supabase (Postgres)
- Supabase Auth
- QR E-Ticket
- Booking Draft / Hold Seat
- Payment Mock Webhook
- Gate Validation
- Notification Log

## ฟีเจอร์หลัก
- สมัครสมาชิก / login
- ลืมรหัสผ่าน / reset password
- อัปโหลดรูปโปรไฟล์
- ค้นหารอบเรือ
- สร้าง booking draft
- บันทึกข้อมูลผู้จองและผู้โดยสาร
- สร้าง payment transaction
- รับ webhook จาก payment gateway
- ออกตั๋วและ QR code อัตโนมัติเมื่อจ่ายสำเร็จ
- เปิดดู My Ticket
- สแกน Gate เพื่อใช้งานตั๋ว
- บันทึก notification และ gate logs
- Admin login / permission-based access control
- Admin dashboard / schedule management / ticket type management
- Standard pricing / Agent pricing
- Booking list / booking detail / reschedule / cancel / refund
- Walk-in POS sale
- Payment admin / reports / users / roles / agents / notifications / settings

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
   - `ADMIN_PASSWORD_RESET_URL` (optional)
   - `PASSWORD_RESET_EXPIRES_MINUTES` (optional)
   - `PROFILE_IMAGE_BUCKET` (optional)
   - `PROFILE_IMAGE_MAX_BYTES` (optional)
   - `BOOKING_HOLD_MINUTES` (optional)
   - `BOOKING_EXPIRY_JOB_ENABLED` (optional)
   - `BOOKING_EXPIRY_JOB_INTERVAL_MS` (optional)

## สำหรับ Production
- password local แบบเดิมจะถูก hash ด้วย `scrypt` ระหว่างช่วง migrate
- customer/admin login จะออก `token` จาก Supabase Auth
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
    "full_name": "Biza Demo",
    "phone": "0812345678",
    "email": "biza@example.com",
    "password": "123456"
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
curl -X POST http://localhost:3000/api/auth/profile/image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "file_name": "avatar.png",
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
        "quantity": 2,
        "unit_price": 120
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
  -d '{
    "contact_name": "Biza Demo",
    "contact_phone": "0812345678",
    "contact_email": "biza@example.com",
    "passengers": [
      { "full_name": "Passenger 1", "passenger_type": "adult" },
      { "full_name": "Passenger 2", "passenger_type": "adult" }
    ]
  }'
```

### 7) Create payment
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "booking_no": "BKXXXXXXXXXX",
    "contact_email": "biza@example.com",
    "payment_method": "qr_promptpay"
  }'
```

### 8) Mock payment webhook success
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

### 9) Get tickets by booking
```bash
curl "http://localhost:3000/api/tickets/booking/BKXXXXXXXXXX?contact_email=biza@example.com"
```

### 10) Validate gate scan
```bash
curl -X POST http://localhost:3000/api/gate/validate \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: ${INTERNAL_API_KEY}" \
  -d '{
    "qr_token": "SCXXXXXXXXXXXXXX",
    "gate_code": "GATE-A",
    "device_code": "SCANNER-01"
  }'
```

## Admin API

ตัวอย่าง route หลักฝั่ง admin:

- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `GET /api/admin/dashboard`
- `GET|POST|PUT /api/admin/schedules`
- `GET|POST|PUT /api/admin/ticket-types`
- `GET|POST|PUT /api/admin/prices/standard`
- `GET|POST|PUT /api/admin/prices/agent`
- `GET|PUT /api/admin/bookings`
- `POST /api/admin/pos/sales`
- `POST /api/admin/gate/scan`
- `GET|POST /api/admin/payments`
- `GET /api/admin/reports/sales`
- `GET /api/admin/reports/passengers`
- `GET|POST|PUT /api/admin/users`
- `GET|POST|PUT /api/admin/roles`
- `GET|POST|PUT /api/admin/agents`
- `GET|POST /api/admin/notifications`
- `GET|PUT /api/admin/settings`

ตัวอย่าง admin login:

```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username_or_email": "admin@example.com",
    "password": "admin123456",
    "remember_me": true
  }'
```

ตัวอย่างสร้างรอบเรือฝั่ง admin:

```bash
curl -X POST http://localhost:3000/api/admin/schedules \
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
curl -X POST http://localhost:3000/api/admin/pos/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{
    "schedule_id": "SCHEDULE_UUID",
    "contact_name": "Walk-in Customer",
    "contact_phone": "0812345678",
    "payment_method": "cash",
    "mark_paid": true,
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
- `expired`
- `refunded`

### Ticket Status
- `active`
- `used`
- `cancelled`
- `expired`

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
