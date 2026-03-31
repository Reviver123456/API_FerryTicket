const jsonContent = (schema) => ({
  required: true,
  content: {
    'application/json': {
      schema
    }
  }
});

const successResponse = (description = 'Success') => ({
  description
});

const authSecurity = [{ bearerAuth: [] }];
const internalSecurity = [{ internalApiKey: [] }];
const webhookSecurity = [{ webhookSecret: [] }];

const schemas = {
  RegisterRequest: {
    type: 'object',
    required: ['first_name', 'last_name', 'email', 'password'],
    properties: {
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      full_name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      password: { type: 'string', format: 'password' }
    }
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' }
    }
  },
  ForgotPasswordRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' }
    }
  },
  ResetPasswordRequest: {
    type: 'object',
    required: ['token', 'new_password'],
    properties: {
      token: { type: 'string' },
      new_password: { type: 'string', format: 'password' }
    }
  },
  AuthMeUpdateRequest: {
    type: 'object',
    properties: {
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      full_name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' }
    }
  },
  ProfileImageRequest: {
    type: 'object',
    required: ['image_base64'],
    properties: {
      image_base64: { type: 'string' },
      mime_type: { type: 'string' }
    }
  },
  RoleRequest: {
    type: 'object',
    required: ['code', 'name', 'permissions'],
    properties: {
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
      status: { type: 'string' },
      sort_order: { type: 'integer' }
    }
  },
  TicketTypeRequest: {
    type: 'object',
    required: ['code', 'name_th'],
    properties: {
      code: { type: 'string' },
      name_th: { type: 'string' },
      name_en: { type: 'string' },
      description: { type: 'string' },
      benefit_text: { type: 'string' },
      display_order: { type: 'integer' },
      requires_document: { type: 'boolean' },
      status: { type: 'string' }
    }
  },
  ScheduleRequest: {
    type: 'object',
    required: ['trip_date', 'departure_time', 'capacity'],
    properties: {
      schedule_code: { type: 'string' },
      trip_date: { type: 'string', format: 'date' },
      departure_time: { type: 'string' },
      arrival_time: { type: 'string' },
      vessel_id: { type: 'string', format: 'uuid' },
      capacity: { type: 'integer' },
      available_seats: { type: 'integer' },
      status: { type: 'string' },
      route_name: { type: 'string' },
      origin_port: { type: 'string' },
      destination_port: { type: 'string' }
    }
  },
  ScheduleCancelRequest: {
    type: 'object',
    properties: {
      reason: { type: 'string' }
    }
  },
  PriceRequest: {
    type: 'object',
    required: ['price_type', 'ticket_type_id', 'effective_from', 'amount'],
    properties: {
      price_type: { type: 'string', enum: ['standard', 'agent'] },
      ticket_type_id: { type: 'string', format: 'uuid' },
      agent_id: { type: 'string', format: 'uuid', nullable: true },
      effective_from: { type: 'string', format: 'date' },
      effective_to: { type: 'string', format: 'date', nullable: true },
      amount: { type: 'number' },
      currency: { type: 'string' },
      status: { type: 'string' }
    }
  },
  BookingDraftRequest: {
    type: 'object',
    required: ['schedule_id', 'items'],
    properties: {
      schedule_id: { type: 'string', format: 'uuid' },
      agent_id: { type: 'string', format: 'uuid', nullable: true },
      source_channel: { type: 'string' },
      guest_email: { type: 'string', format: 'email', nullable: true },
      guest_phone: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['ticket_type_id', 'quantity'],
          properties: {
            ticket_type_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer' },
            manual_unit_price: { type: 'number', nullable: true }
          }
        }
      }
    }
  },
  BookingUpdateRequest: {
    type: 'object',
    properties: {
      guest_email: { type: 'string', format: 'email' },
      guest_phone: { type: 'string' },
      contact_name: { type: 'string' },
      contact_email: { type: 'string', format: 'email' },
      contact_phone: { type: 'string' },
      notes: { type: 'string' }
    }
  },
  PassengerListRequest: {
    type: 'object',
    required: ['passengers'],
    properties: {
      contact_email: { type: 'string', format: 'email' },
      passengers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['full_name'],
          properties: {
            full_name: { type: 'string' },
            passenger_type: { type: 'string' },
            seat_no: { type: 'string', nullable: true },
            remark: { type: 'string', nullable: true }
          }
        }
      }
    }
  },
  BookingChangeScheduleRequest: {
    type: 'object',
    required: ['schedule_id'],
    properties: {
      schedule_id: { type: 'string', format: 'uuid' },
      contact_email: { type: 'string', format: 'email' }
    }
  },
  PaymentCreateRequest: {
    type: 'object',
    required: ['booking_no'],
    properties: {
      booking_no: { type: 'string' },
      contact_email: { type: 'string', format: 'email' },
      payment_method: { type: 'string' }
    }
  },
  PaymentConfirmRequest: {
    type: 'object',
    properties: {
      transaction_id: { type: 'string' },
      reference_no: { type: 'string' },
      amount: { type: 'number' },
      note: { type: 'string' }
    }
  },
  PaymentRefundRequest: {
    type: 'object',
    properties: {
      reason: { type: 'string' }
    }
  },
  NotificationRequest: {
    type: 'object',
    required: ['message'],
    properties: {
      user_id: { type: 'string', format: 'uuid', nullable: true },
      booking_id: { type: 'string', format: 'uuid', nullable: true },
      ticket_id: { type: 'string', format: 'uuid', nullable: true },
      broadcast: { type: 'boolean' },
      channel: { type: 'string' },
      type: { type: 'string' },
      priority: { type: 'string' },
      subject: { type: 'string' },
      message: { type: 'string' },
      target_path: { type: 'string' },
      meta_json: { type: 'object' }
    }
  },
  PosSaleRequest: {
    type: 'object',
    required: ['schedule_id', 'items', 'contact_name', 'contact_email', 'contact_phone', 'passengers'],
    properties: {
      schedule_id: { type: 'string', format: 'uuid' },
      agent_id: { type: 'string', format: 'uuid', nullable: true },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['ticket_type_id', 'quantity'],
          properties: {
            ticket_type_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer' }
          }
        }
      },
      contact_name: { type: 'string' },
      contact_email: { type: 'string', format: 'email' },
      contact_phone: { type: 'string' },
      passengers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['full_name'],
          properties: {
            full_name: { type: 'string' },
            passenger_type: { type: 'string' }
          }
        }
      },
      payment_method: { type: 'string' },
      transaction_id: { type: 'string' },
      notes: { type: 'string' }
    }
  },
  AgentRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      agent_code: { type: 'string' },
      name: { type: 'string' },
      company_name: { type: 'string' },
      contact_name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      payment_terms_days: { type: 'integer' },
      credit_limit: { type: 'number' },
      status: { type: 'string' },
      contract_notes: { type: 'string' },
      address: { type: 'string' },
      metadata: { type: 'object' }
    }
  },
  SettingsRequest: {
    type: 'object',
    required: ['settings'],
    properties: {
      settings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category', 'key'],
          properties: {
            category: { type: 'string' },
            key: { type: 'string' },
            value_json: { type: 'object' },
            description: { type: 'string' },
            is_public: { type: 'boolean' }
          }
        }
      }
    }
  },
  UserRequest: {
    type: 'object',
    required: ['first_name', 'last_name', 'email', 'password', 'role_code'],
    properties: {
      code: { type: 'string' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      full_name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      password: { type: 'string', format: 'password' },
      role_id: { type: 'string', format: 'uuid' },
      role_code: { type: 'string' },
      user_type: { type: 'string' },
      status: { type: 'string' }
    }
  },
  UserUpdateRequest: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      full_name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      role_id: { type: 'string', format: 'uuid' },
      role_code: { type: 'string' },
      user_type: { type: 'string' },
      status: { type: 'string' }
    }
  },
  UserResetPasswordRequest: {
    type: 'object',
    required: ['new_password'],
    properties: {
      new_password: { type: 'string', format: 'password' }
    }
  }
};

const buildPaths = () => ({
  '/': {
    get: { tags: ['System'], summary: 'API root metadata', responses: { 200: successResponse('Root metadata loaded') } }
  },
  '/health': {
    get: { tags: ['System'], summary: 'Health check', responses: { 200: successResponse('Health check OK') } }
  },
  '/docs': {
    get: { tags: ['System'], summary: 'Swagger UI', responses: { 200: successResponse('Swagger UI HTML') } }
  },
  '/docs/openapi.json': {
    get: { tags: ['System'], summary: 'OpenAPI document', responses: { 200: successResponse('OpenAPI document') } }
  },
  '/api/auth/register': {
    post: { tags: ['Auth'], summary: 'Register user', requestBody: jsonContent({ $ref: '#/components/schemas/RegisterRequest' }), responses: { 201: successResponse('User registered') } }
  },
  '/api/auth/login': {
    post: { tags: ['Auth'], summary: 'Login user', requestBody: jsonContent({ $ref: '#/components/schemas/LoginRequest' }), responses: { 200: successResponse('Login successful') } }
  },
  '/api/auth/forgot-password': {
    post: { tags: ['Auth'], summary: 'Request password reset', requestBody: jsonContent({ $ref: '#/components/schemas/ForgotPasswordRequest' }), responses: { 200: successResponse('Password reset requested') } }
  },
  '/api/auth/reset-password': {
    post: { tags: ['Auth'], summary: 'Reset password', requestBody: jsonContent({ $ref: '#/components/schemas/ResetPasswordRequest' }), responses: { 200: successResponse('Password reset successful') } }
  },
  '/api/auth/me': {
    get: { tags: ['Auth'], summary: 'Get current user', security: authSecurity, responses: { 200: successResponse('Profile loaded') } },
    put: { tags: ['Auth'], summary: 'Update current user', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/AuthMeUpdateRequest' }), responses: { 200: successResponse('Profile updated') } }
  },
  '/api/auth/me/profile-image': {
    post: { tags: ['Auth'], summary: 'Upload profile image', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/ProfileImageRequest' }), responses: { 200: successResponse('Profile image updated') } }
  },
  '/api/auth/logout': {
    post: { tags: ['Auth'], summary: 'Logout', security: authSecurity, responses: { 200: successResponse('Logout successful') } }
  },
  '/api/roles': {
    get: { tags: ['Roles'], summary: 'List roles', security: authSecurity, responses: { 200: successResponse('Roles loaded') } },
    post: { tags: ['Roles'], summary: 'Create role', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/RoleRequest' }), responses: { 201: successResponse('Role created') } }
  },
  '/api/roles/{code}': {
    put: { tags: ['Roles'], summary: 'Update role', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/RoleRequest' }), responses: { 200: successResponse('Role updated') } }
  },
  '/api/permissions': {
    get: { tags: ['Roles'], summary: 'List permission catalog', security: authSecurity, responses: { 200: successResponse('Permissions loaded') } }
  },
  '/api/ticket-types': {
    get: { tags: ['Ticket Types'], summary: 'List ticket types', responses: { 200: successResponse('Ticket types loaded') } },
    post: { tags: ['Ticket Types'], summary: 'Create ticket type', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/TicketTypeRequest' }), responses: { 201: successResponse('Ticket type created') } }
  },
  '/api/ticket-types/{id}': {
    get: { tags: ['Ticket Types'], summary: 'Get ticket type', responses: { 200: successResponse('Ticket type loaded') } },
    put: { tags: ['Ticket Types'], summary: 'Update ticket type', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/TicketTypeRequest' }), responses: { 200: successResponse('Ticket type updated') } }
  },
  '/api/schedules': {
    get: { tags: ['Schedules'], summary: 'List schedules', responses: { 200: successResponse('Schedules loaded') } },
    post: { tags: ['Schedules'], summary: 'Create schedule', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/ScheduleRequest' }), responses: { 201: successResponse('Schedule created') } }
  },
  '/api/schedules/{id}': {
    get: { tags: ['Schedules'], summary: 'Get schedule', responses: { 200: successResponse('Schedule loaded') } },
    put: { tags: ['Schedules'], summary: 'Update schedule', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/ScheduleRequest' }), responses: { 200: successResponse('Schedule updated') } }
  },
  '/api/schedules/{id}/open-sales': {
    post: { tags: ['Schedules'], summary: 'Open schedule sales', security: authSecurity, responses: { 200: successResponse('Schedule sales opened') } }
  },
  '/api/schedules/{id}/close-sales': {
    post: { tags: ['Schedules'], summary: 'Close schedule sales', security: authSecurity, responses: { 200: successResponse('Schedule sales closed') } }
  },
  '/api/schedules/{id}/cancel': {
    post: { tags: ['Schedules'], summary: 'Cancel schedule', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/ScheduleCancelRequest' }), responses: { 200: successResponse('Schedule cancelled') } }
  },
  '/api/prices': {
    get: { tags: ['Prices'], summary: 'List prices', security: authSecurity, responses: { 200: successResponse('Prices loaded') } },
    post: { tags: ['Prices'], summary: 'Create price', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PriceRequest' }), responses: { 201: successResponse('Price created') } }
  },
  '/api/prices/preview': {
    get: { tags: ['Prices'], summary: 'Preview resolved price', security: authSecurity, responses: { 200: successResponse('Price preview loaded') } }
  },
  '/api/prices/{id}': {
    get: { tags: ['Prices'], summary: 'Get price', security: authSecurity, responses: { 200: successResponse('Price loaded') } },
    put: { tags: ['Prices'], summary: 'Update price', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PriceRequest' }), responses: { 200: successResponse('Price updated') } }
  },
  '/api/bookings/draft': {
    post: { tags: ['Bookings'], summary: 'Create booking draft', requestBody: jsonContent({ $ref: '#/components/schemas/BookingDraftRequest' }), responses: { 201: successResponse('Booking draft created') } }
  },
  '/api/bookings': {
    get: { tags: ['Bookings'], summary: 'List bookings', security: authSecurity, responses: { 200: successResponse('Bookings loaded') } }
  },
  '/api/bookings/{bookingNo}': {
    get: { tags: ['Bookings'], summary: 'Get booking', responses: { 200: successResponse('Booking loaded') } },
    put: { tags: ['Bookings'], summary: 'Update booking', requestBody: jsonContent({ $ref: '#/components/schemas/BookingUpdateRequest' }), responses: { 200: successResponse('Booking updated') } }
  },
  '/api/bookings/{bookingNo}/passengers': {
    get: { tags: ['Bookings'], summary: 'List booking passengers', responses: { 200: successResponse('Passengers loaded') } },
    put: { tags: ['Bookings'], summary: 'Replace booking passengers', requestBody: jsonContent({ $ref: '#/components/schemas/PassengerListRequest' }), responses: { 200: successResponse('Passengers updated') } }
  },
  '/api/bookings/{bookingNo}/cancel': {
    post: { tags: ['Bookings'], summary: 'Cancel booking', requestBody: jsonContent({ $ref: '#/components/schemas/PaymentRefundRequest' }), responses: { 200: successResponse('Booking cancelled') } }
  },
  '/api/bookings/{bookingNo}/change-schedule': {
    post: { tags: ['Bookings'], summary: 'Change booking schedule', requestBody: jsonContent({ $ref: '#/components/schemas/BookingChangeScheduleRequest' }), responses: { 200: successResponse('Booking schedule changed') } }
  },
  '/api/bookings/{bookingNo}/mark-paid': {
    post: { tags: ['Bookings'], summary: 'Mark booking paid', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PaymentConfirmRequest' }), responses: { 200: successResponse('Booking payment confirmed') } }
  },
  '/api/bookings/{bookingNo}/resend-tickets': {
    post: { tags: ['Bookings'], summary: 'Resend booking tickets', responses: { 200: successResponse('Tickets resent') } }
  },
  '/api/bookings/{bookingNo}/refund': {
    post: { tags: ['Bookings'], summary: 'Refund booking', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PaymentRefundRequest' }), responses: { 200: successResponse('Booking refunded') } }
  },
  '/api/bookings/jobs/expire-stale': {
    post: { tags: ['Bookings'], summary: 'Expire stale booking drafts', security: internalSecurity, responses: { 200: successResponse('Expired stale bookings') } }
  },
  '/api/payments': {
    post: { tags: ['Payments'], summary: 'Create payment', requestBody: jsonContent({ $ref: '#/components/schemas/PaymentCreateRequest' }), responses: { 201: successResponse('Payment created') } },
    get: { tags: ['Payments'], summary: 'List payments', security: authSecurity, responses: { 200: successResponse('Payments loaded') } }
  },
  '/api/payments/{paymentRef}': {
    get: { tags: ['Payments'], summary: 'Get payment', responses: { 200: successResponse('Payment loaded') } }
  },
  '/api/payments/{paymentRef}/confirm': {
    post: { tags: ['Payments'], summary: 'Confirm payment', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PaymentConfirmRequest' }), responses: { 200: successResponse('Payment confirmed') } }
  },
  '/api/payments/{paymentRef}/refund': {
    post: { tags: ['Payments'], summary: 'Refund payment', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PaymentRefundRequest' }), responses: { 200: successResponse('Payment refunded') } }
  },
  '/api/payments/webhook/callback': {
    post: { tags: ['Payments'], summary: 'Payment webhook callback', security: webhookSecurity, requestBody: jsonContent({ type: 'object' }), responses: { 200: successResponse('Webhook processed') } }
  },
  '/api/tickets': {
    get: { tags: ['Tickets'], summary: 'List tickets', security: authSecurity, responses: { 200: successResponse('Tickets loaded') } }
  },
  '/api/tickets/{ticketNo}': {
    get: { tags: ['Tickets'], summary: 'Get ticket', responses: { 200: successResponse('Ticket loaded') } }
  },
  '/api/tickets/resend': {
    post: { tags: ['Tickets'], summary: 'Resend tickets', requestBody: jsonContent({ type: 'object', required: ['booking_no'], properties: { booking_no: { type: 'string' }, contact_email: { type: 'string', format: 'email' } } }), responses: { 200: successResponse('Tickets resent') } }
  },
  '/api/notifications': {
    get: { tags: ['Notifications'], summary: 'List notifications', security: authSecurity, responses: { 200: successResponse('Notifications loaded') } },
    post: { tags: ['Notifications'], summary: 'Create notification', security: [{ bearerAuth: [] }, { internalApiKey: [] }], requestBody: jsonContent({ $ref: '#/components/schemas/NotificationRequest' }), responses: { 201: successResponse('Notification created') } }
  },
  '/api/notifications/{id}/read': {
    post: { tags: ['Notifications'], summary: 'Mark notification as read', security: authSecurity, responses: { 200: successResponse('Notification marked as read') } }
  },
  '/api/dashboard': {
    get: { tags: ['Analytics'], summary: 'Dashboard overview', security: authSecurity, responses: { 200: successResponse('Dashboard loaded') } }
  },
  '/api/reports/sales': {
    get: { tags: ['Analytics'], summary: 'Sales report', security: authSecurity, responses: { 200: successResponse('Sales report loaded') } }
  },
  '/api/reports/passengers': {
    get: { tags: ['Analytics'], summary: 'Passenger report', security: authSecurity, responses: { 200: successResponse('Passenger report loaded') } }
  },
  '/api/pos/sales': {
    post: { tags: ['POS'], summary: 'Create walk-in sale', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/PosSaleRequest' }), responses: { 201: successResponse('POS sale created') } },
    get: { tags: ['POS'], summary: 'List walk-in sales', security: authSecurity, responses: { 200: successResponse('POS sales loaded') } }
  },
  '/api/pos/sales/{id}': {
    get: { tags: ['POS'], summary: 'Get walk-in sale', security: authSecurity, responses: { 200: successResponse('POS sale loaded') } }
  },
  '/api/agents': {
    get: { tags: ['Agents'], summary: 'List agents', security: authSecurity, responses: { 200: successResponse('Agents loaded') } },
    post: { tags: ['Agents'], summary: 'Create agent', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/AgentRequest' }), responses: { 201: successResponse('Agent created') } }
  },
  '/api/agents/{id}': {
    put: { tags: ['Agents'], summary: 'Update agent', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/AgentRequest' }), responses: { 200: successResponse('Agent updated') } }
  },
  '/api/agents/{id}/sales': {
    get: { tags: ['Agents'], summary: 'Agent sales summary', security: authSecurity, responses: { 200: successResponse('Agent sales loaded') } }
  },
  '/api/settings': {
    get: { tags: ['Settings'], summary: 'List settings', security: authSecurity, responses: { 200: successResponse('Settings loaded') } },
    put: { tags: ['Settings'], summary: 'Update settings', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/SettingsRequest' }), responses: { 200: successResponse('Settings updated') } }
  },
  '/api/settings/export': {
    get: { tags: ['Settings'], summary: 'Export settings', security: authSecurity, responses: { 200: successResponse('Settings exported') } }
  },
  '/api/settings/import': {
    post: { tags: ['Settings'], summary: 'Import settings', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/SettingsRequest' }), responses: { 200: successResponse('Settings imported') } }
  },
  '/api/users': {
    get: { tags: ['Users'], summary: 'List users', security: authSecurity, responses: { 200: successResponse('Users loaded') } },
    post: { tags: ['Users'], summary: 'Create user', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/UserRequest' }), responses: { 201: successResponse('User created') } }
  },
  '/api/users/{id}': {
    get: { tags: ['Users'], summary: 'Get user', security: authSecurity, responses: { 200: successResponse('User loaded') } },
    put: { tags: ['Users'], summary: 'Update user', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/UserUpdateRequest' }), responses: { 200: successResponse('User updated') } }
  },
  '/api/users/{id}/reset-password': {
    post: { tags: ['Users'], summary: 'Reset user password', security: authSecurity, requestBody: jsonContent({ $ref: '#/components/schemas/UserResetPasswordRequest' }), responses: { 200: successResponse('User password reset') } }
  }
});

const openApiDocumentBase = {
  openapi: '3.0.3',
  info: {
    title: 'Ferry Ticketing API',
    version: '2.0.0',
    description: 'Unified ferry ticketing API with shared auth, roles, pricing, bookings, payments, tickets, notifications, analytics, POS, agents, settings, and user management.'
  },
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Roles' },
    { name: 'Ticket Types' },
    { name: 'Schedules' },
    { name: 'Prices' },
    { name: 'Bookings' },
    { name: 'Payments' },
    { name: 'Tickets' },
    { name: 'Notifications' },
    { name: 'Analytics' },
    { name: 'POS' },
    { name: 'Agents' },
    { name: 'Settings' },
    { name: 'Users' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      internalApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-internal-api-key'
      },
      webhookSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'x-webhook-secret'
      }
    },
    schemas
  }
};

export const buildOpenApiDocument = (serverUrl = 'http://localhost:3000') => ({
  ...openApiDocumentBase,
  servers: [{ url: serverUrl }],
  paths: buildPaths()
});

export const swaggerUiHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ferry Ticketing API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/docs/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`;
