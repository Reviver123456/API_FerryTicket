import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';

const baseUrl = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${env.port}`;
const unique = Date.now();
const email = `smoke+${unique}@example.com`;
const password = 'ProdReady123!';

const request = async (path, { body, headers = {}, ...init } = {}) => {
  const finalHeaders = { ...headers };
  let finalBody = body;

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: finalHeaders,
    body: finalBody
  });

  const text = await res.text();
  const payload = JSON.parse(text);

  if (!res.ok || payload.success === false) {
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }

  return payload.data;
};

const supabase = createClient(env.supabaseUrl, env.supabaseServerKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data: ticketType, error: ticketTypeError } = await supabase
  .from('ticket_types')
  .select('id, price')
  .eq('code', 'ADULT')
  .single();

if (ticketTypeError) throw ticketTypeError;

const schedules = await request('/api/schedules');
const scheduleId = schedules[0]?.id;
if (!scheduleId) throw new Error('No schedules available');

await request('/api/auth/register', {
  method: 'POST',
  body: {
    full_name: 'Smoke Test',
    phone: '0812345678',
    email,
    password
  }
});

await request('/api/auth/login', {
  method: 'POST',
  body: { email, password }
});

const booking = await request('/api/bookings/draft', {
  method: 'POST',
  body: {
    schedule_id: scheduleId,
    items: [
      {
        ticket_type_id: ticketType.id,
        quantity: 2,
        unit_price: Number(ticketType.price)
      }
    ]
  }
});

await request(`/api/bookings/${booking.booking_no}`, {
  method: 'PUT',
  body: {
    contact_name: 'Smoke Test',
    contact_phone: '0812345678',
    contact_email: email,
    passengers: [
      { full_name: 'Passenger 1', passenger_type: 'adult' },
      { full_name: 'Passenger 2', passenger_type: 'adult' }
    ]
  }
});

const payment = await request('/api/payments', {
  method: 'POST',
  body: {
    booking_no: booking.booking_no,
    contact_email: email,
    payment_method: 'qr_promptpay'
  }
});

await request('/api/payments/webhook/callback', {
  method: 'POST',
  headers: {
    'x-webhook-secret': env.paymentWebhookSecret
  },
  body: {
    payment_ref: payment.payment_ref,
    status: 'success',
    transaction_id: `TXN-${unique}`,
    amount: Number(payment.amount)
  }
});

const tickets = await request(`/api/tickets/booking/${booking.booking_no}?contact_email=${encodeURIComponent(email)}`);
const gate = await request('/api/gate/validate', {
  method: 'POST',
  headers: {
    'x-internal-api-key': env.internalApiKey
  },
  body: {
    qr_token: tickets[0].qr_token,
    gate_code: 'GATE-A',
    device_code: 'SMOKE-01'
  }
});

console.log(JSON.stringify({
  booking_no: booking.booking_no,
  payment_ref: payment.payment_ref,
  tickets_issued: tickets.length,
  gate_result: gate.result
}, null, 2));
