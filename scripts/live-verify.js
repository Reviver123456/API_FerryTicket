const baseUrl = process.env.LIVE_BASE_URL || 'https://api-ferryticket.onrender.com';
const today = process.env.LIVE_VERIFY_DATE || '2026-04-01';
const unique = Date.now();
const customerEmail = `verify.${unique}@example.com`;
const customerPassword = 'ProdReady123!';
const png1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0f8AAAAASUVORK5CYII=';

const failures = [];
let passes = 0;

const record = (name, ok, note = '') => {
  if (ok) {
    passes += 1;
    return;
  }

  failures.push({ name, note });
};

const request = async (path, { method = 'GET', token, body, headers = {}, expectJson = true } = {}) => {
  const finalHeaders = { ...headers };
  let finalBody = body;

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && !finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
    finalHeaders['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: finalHeaders,
    body: finalBody,
    signal: AbortSignal.timeout(20_000)
  });

  const text = await res.text();
  let json = null;

  if (expectJson) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return { res, text, json };
};

const expectStatus = async (name, path, expected, options = {}) => {
  try {
    const { res, text, json } = await request(path, options);
    const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
    record(name, ok, ok ? '' : `${res.status} ${json?.message || text.slice(0, 200)}`);
    return { res, text, json };
  } catch (error) {
    record(name, false, error.message);
    return { res: { status: 0 }, text: '', json: null };
  }
};

const summary = {
  date: '2026-04-01',
  base_url: baseUrl,
  sample_booking_no: null,
  sample_payment_ref: null,
  sample_pos_booking_no: null
};

await expectStatus('root', '/', 200, { expectJson: false });
await expectStatus('health', '/health', 200);
await expectStatus('docs', '/docs', 200, { expectJson: false });
await expectStatus('openapi', '/docs/openapi.json', 200);

const ticketTypesRes = await expectStatus('ticket-types public', '/api/ticket-types', 200);
const schedulesRes = await expectStatus('schedules public', `/api/schedules?trip_date=${today}`, 200);
const ticketTypes = ticketTypesRes.json?.data || [];
const schedules = schedulesRes.json?.data || [];
const adultTicket = ticketTypes.find((item) => item.code === 'ADULT') || ticketTypes[0];
const firstSchedule = schedules[0];
const secondSchedule = schedules[1] || schedules[0];

if (adultTicket) {
  await expectStatus(
    'prices preview public',
    `/api/prices/preview?ticket_type_id=${encodeURIComponent(adultTicket.id)}`,
    200
  );
}

await expectStatus('register customer', '/api/auth/register', 201, {
  method: 'POST',
  body: {
    first_name: 'Verify',
    last_name: 'Customer',
    phone: '0812345678',
    email: customerEmail,
    password: customerPassword
  }
});

const customerLogin = await expectStatus('login customer', '/api/auth/login', 200, {
  method: 'POST',
  body: {
    email: customerEmail,
    password: customerPassword
  }
});

const customerToken = customerLogin.json?.data?.token;

await expectStatus('auth me customer', '/api/auth/me', 200, { token: customerToken });
await expectStatus('auth me update customer', '/api/auth/me', 200, {
  method: 'PUT',
  token: customerToken,
  body: {
    first_name: 'Verify2',
    last_name: 'Customer',
    phone: '0812345679'
  }
});
await expectStatus('profile image upload customer', '/api/auth/me/profile-image', 200, {
  method: 'POST',
  token: customerToken,
  body: {
    image_base64: png1x1,
    mime_type: 'image/png'
  }
});
await expectStatus('forgot password customer', '/api/auth/forgot-password', 200, {
  method: 'POST',
  body: {
    email: customerEmail
  }
});

let bookingNo = null;
let paymentRef = null;

if (adultTicket && firstSchedule && customerToken) {
  const draft = await expectStatus('booking draft customer', '/api/bookings/draft', 201, {
    method: 'POST',
    token: customerToken,
    body: {
      schedule_id: firstSchedule.id,
      items: [
        {
          ticket_type_id: adultTicket.id,
          quantity: 1
        }
      ]
    }
  });

  bookingNo = draft.json?.data?.booking_no;
  summary.sample_booking_no = bookingNo;
}

if (bookingNo && customerToken) {
  await expectStatus('booking update customer', `/api/bookings/${bookingNo}`, 200, {
    method: 'PUT',
    token: customerToken,
    body: {
      contact_name: 'Verify Customer',
      contact_email: customerEmail,
      contact_phone: '0812345678'
    }
  });

  await expectStatus('booking passengers customer', `/api/bookings/${bookingNo}/passengers`, 200, {
    method: 'PUT',
    token: customerToken,
    body: {
      passengers: [{ full_name: 'Verify Passenger', passenger_type: 'adult' }]
    }
  });

  await expectStatus('bookings list customer', '/api/bookings', 200, { token: customerToken });
  await expectStatus('booking detail customer', `/api/bookings/${bookingNo}`, 200, { token: customerToken });
  await expectStatus('booking passengers detail customer', `/api/bookings/${bookingNo}/passengers`, 200, {
    token: customerToken
  });

  if (secondSchedule && secondSchedule.id !== firstSchedule.id) {
    await expectStatus('booking change schedule customer', `/api/bookings/${bookingNo}/change-schedule`, 200, {
      method: 'POST',
      token: customerToken,
      body: {
        schedule_id: secondSchedule.id
      }
    });
  }

  const payment = await expectStatus('payment create customer', '/api/payments', 201, {
    method: 'POST',
    token: customerToken,
    body: {
      booking_no: bookingNo,
      contact_email: customerEmail,
      payment_method: 'qr_promptpay'
    }
  });

  paymentRef = payment.json?.data?.payment_ref;
  summary.sample_payment_ref = paymentRef;

  await expectStatus('payments list customer', '/api/payments', 200, { token: customerToken });
  await expectStatus('tickets by booking customer', `/api/tickets?bookingNo=${encodeURIComponent(bookingNo)}`, 200, {
    token: customerToken
  });
  await expectStatus('logout customer', '/api/auth/logout', 200, {
    method: 'POST',
    token: customerToken
  });
  await expectStatus('booking cancel customer', `/api/bookings/${bookingNo}/cancel`, 200, {
    method: 'POST',
    token: customerToken,
    body: {
      reason: 'verification cleanup'
    }
  });
}

const staffLogin = await expectStatus('login staff', '/api/auth/login', 200, {
  method: 'POST',
  body: {
    email: 'staff@example.com',
    password: 'admin123456'
  }
});

const staffToken = staffLogin.json?.data?.token;
const staffUserId = staffLogin.json?.data?.user?.id;

await expectStatus('dashboard staff', '/api/dashboard', 200, { token: staffToken });
await expectStatus('reports sales staff', `/api/reports/sales?dateFrom=2026-03-01&dateTo=${today}`, 200, {
  token: staffToken
});
await expectStatus(
  'reports passengers staff',
  `/api/reports/passengers?dateFrom=2026-03-01&dateTo=${today}`,
  200,
  { token: staffToken }
);
await expectStatus('notifications list staff', '/api/notifications', 200, { token: staffToken });
await expectStatus('payments list staff', '/api/payments?limit=5', 200, { token: staffToken });
await expectStatus('tickets list staff', '/api/tickets', 200, { token: staffToken });
await expectStatus('bookings list staff', '/api/bookings?limit=5', 200, { token: staffToken });
await expectStatus('bookings filtered staff', '/api/bookings?bookingNo=BKW3XTDG4LS9', 200, {
  token: staffToken
});
await expectStatus('booking detail staff', '/api/bookings/BKW3XTDG4LS9', 200, { token: staffToken });

if (staffUserId && staffToken) {
  const notification = await expectStatus('notification create staff', '/api/notifications', 201, {
    method: 'POST',
    token: staffToken,
    body: {
      user_id: staffUserId,
      channel: 'internal',
      type: 'info',
      priority: 'normal',
      subject: 'Verify notification',
      message: 'Verification notification'
    }
  });

  const notificationId = Array.isArray(notification.json?.data) ? notification.json.data[0]?.id : null;
  if (notificationId) {
    await expectStatus('notification read staff', `/api/notifications/${notificationId}/read`, 200, {
      method: 'POST',
      token: staffToken
    });
  }
}

let posBookingId = null;
let posBookingNo = null;

if (adultTicket && firstSchedule && staffToken) {
  const posSale = await expectStatus('pos sale staff', '/api/pos/sales', 201, {
    method: 'POST',
    token: staffToken,
    body: {
      schedule_id: firstSchedule.id,
      items: [
        {
          ticket_type_id: adultTicket.id,
          quantity: 1
        }
      ],
      contact_name: 'Verify POS',
      contact_email: `pos.${unique}@example.com`,
      contact_phone: '0891234567',
      passengers: [{ full_name: 'Verify POS Passenger', passenger_type: 'adult' }],
      payment_method: 'cash',
      transaction_id: `POS-${unique}`,
      notes: 'verification'
    }
  });

  posBookingId = posSale.json?.data?.id;
  posBookingNo = posSale.json?.data?.booking_no;
  summary.sample_pos_booking_no = posBookingNo;
}

await expectStatus('pos sales list staff', '/api/pos/sales', 200, { token: staffToken });

if (posBookingId) {
  await expectStatus('pos sale detail staff', `/api/pos/sales/${posBookingId}`, 200, { token: staffToken });
}

if (posBookingNo) {
  await expectStatus('tickets resend staff', '/api/tickets/resend', 200, {
    method: 'POST',
    token: staffToken,
    body: {
      booking_no: posBookingNo
    }
  });
  await expectStatus('booking resend staff', `/api/bookings/${posBookingNo}/resend-tickets`, 200, {
    method: 'POST',
    token: staffToken,
    body: {}
  });
}

const adminLogin = await expectStatus('login admin', '/api/auth/login', 200, {
  method: 'POST',
  body: {
    email: 'admin@example.com',
    password: 'admin123456'
  }
});

const adminToken = adminLogin.json?.data?.token;

await expectStatus('prices list admin', '/api/prices', 200, { token: adminToken });
await expectStatus('settings admin', '/api/settings', 200, { token: adminToken });
await expectStatus('users list admin', '/api/users', 200, { token: adminToken });
await expectStatus('roles list admin', '/api/roles', 200, { token: adminToken });
await expectStatus('permissions list admin', '/api/permissions', 200, { token: adminToken });
await expectStatus('agents list admin', '/api/agents', 200, { token: adminToken });

console.log(
  JSON.stringify(
    {
      ...summary,
      passes,
      failures: failures.length,
      failed_checks: failures
    },
    null,
    2
  )
);

process.exit(failures.length > 0 ? 1 : 0);
