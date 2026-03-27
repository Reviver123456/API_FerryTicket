# API_FerryTicket

โปรเจกต์นี้เป็น Backend แบบ Full System สำหรับระบบจองตั๋วเรือ โดยใช้:
- Node.js + Express
- Supabase (Postgres)
- QR E-Ticket
- Booking Draft / Hold Seat
- Payment Mock Webhook
- Gate Validation
- Notification Log

## ฟีเจอร์หลัก
- สมัครสมาชิก / login
- ค้นหารอบเรือ
- สร้าง booking draft
- บันทึกข้อมูลผู้จองและผู้โดยสาร
- สร้าง payment transaction
- รับ webhook จาก payment gateway
- ออกตั๋วและ QR code อัตโนมัติเมื่อจ่ายสำเร็จ
- เปิดดู My Ticket
- สแกน Gate เพื่อใช้งานตั๋ว
- บันทึก notification และ gate logs

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
4. นำค่าเหล่านี้มาใส่ใน `.env`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` หรือ `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `PAYMENT_WEBHOOK_SECRET`
   - `INTERNAL_API_KEY`
   - `JWT_SECRET`

## สำหรับ Production
- backend จะ hash password ด้วย `scrypt`
- route ภายในต้องส่ง `x-internal-api-key`
- payment webhook ต้องส่ง `x-webhook-secret`
- CORS จะใช้ allowlist จาก `CORS_ORIGINS`
- มี rate limit พื้นฐานสำหรับทั้งระบบและ route auth
- มี `GET /health` สำหรับ health check

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

### 3) Get schedules
```bash
curl http://localhost:3000/api/schedules
```

### 4) Create booking draft
```bash
curl -X POST http://localhost:3000/api/bookings/draft \
  -H "Content-Type: application/json" \
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

### 5) Update booking info
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

### 6) Create payment
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "booking_no": "BKXXXXXXXXXX",
    "contact_email": "biza@example.com",
    "payment_method": "qr_promptpay"
  }'
```

### 7) Mock payment webhook success
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

### 8) Get tickets by booking
```bash
curl "http://localhost:3000/api/tickets/booking/BKXXXXXXXXXX?contact_email=biza@example.com"
```

### 9) Validate gate scan
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
- ควรเพิ่มระบบ admin dashboard, report API, refund flow และ queue job ในเฟสถัดไป

## สิ่งที่แนะนำให้ทำต่อ
- ต่อ frontend React / Next.js
- เชื่อม PromptPay / Omise / 2C2P / GB Prime Pay
- ใช้ Supabase Auth แทน password แบบ local
- เพิ่ม cron job สำหรับ expire booking อัตโนมัติ
- เพิ่ม Swagger / OpenAPI
- เพิ่ม unit test และ integration test
