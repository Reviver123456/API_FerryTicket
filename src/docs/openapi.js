import { env } from '../config/env.js';

const jsonContent = (schema, example) => ({
  required: true,
  content: {
    'application/json': {
      schema,
      ...(example ? { example } : {})
    }
  }
});

const textHtml = (html) => ({
  content: {
    'text/html': {
      schema: {
        type: 'string'
      },
      example: html
    }
  }
});

const successResponse = (description = 'Success') => ({
  description
});

const authSecurity = [{ bearerAuth: [] }];
const internalApiSecurity = [{ internalApiKey: [] }];
const webhookSecurity = [{ webhookSecret: [] }];

const authSessionSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    refresh_token: { type: 'string' },
    session: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        expires_in: { type: 'integer' },
        expires_at: { type: 'integer', nullable: true },
        token_type: { type: 'string' }
      }
    }
  }
};

const customerAuthRequestSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    full_name: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', format: 'password' }
  }
};

const adminAuthRequestSchema = {
  type: 'object',
  required: ['username_or_email', 'password'],
  properties: {
    username_or_email: { type: 'string' },
    password: { type: 'string', format: 'password' },
    remember_me: { type: 'boolean' }
  }
};

const bookingDraftSchema = {
  type: 'object',
  required: ['schedule_id', 'items'],
  properties: {
    schedule_id: { type: 'string', format: 'uuid' },
    agent_id: { type: 'string', format: 'uuid', nullable: true },
    source_channel: { type: 'string' },
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
};

const bookingUpdateSchema = {
  type: 'object',
  required: ['contact_name', 'contact_phone', 'contact_email', 'passengers'],
  properties: {
    contact_name: { type: 'string' },
    contact_phone: { type: 'string' },
    contact_email: { type: 'string', format: 'email' },
    passengers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['full_name'],
        properties: {
          full_name: { type: 'string' },
          passenger_type: { type: 'string' },
          remark: { type: 'string', nullable: true }
        }
      }
    }
  }
};

const priceRuleSchema = {
  type: 'object',
  required: ['ticket_type_id', 'price', 'valid_from'],
  properties: {
    ticket_type_id: { type: 'string', format: 'uuid' },
    route_name: { type: 'string', nullable: true },
    schedule_id: { type: 'string', format: 'uuid', nullable: true },
    price: { type: 'number' },
    valid_from: { type: 'string', format: 'date' },
    valid_to: { type: 'string', format: 'date', nullable: true },
    status: { type: 'string' },
    version_label: { type: 'string', nullable: true }
  }
};

const openApiDocumentBase = {
  openapi: '3.0.3',
  info: {
    title: 'Ferry Ticketing API',
    version: '1.1.0',
    description: 'API for ferry booking, POS ticket sales, gate validation, admin operations, reporting, pricing, and system settings.'
  },
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Catalog' },
    { name: 'Bookings' },
    { name: 'Payments' },
    { name: 'Tickets' },
    { name: 'Gate' },
    { name: 'Notifications' },
    { name: 'Admin Auth' },
    { name: 'Admin Dashboard' },
    { name: 'Admin Schedules' },
    { name: 'Admin Ticket Types' },
    { name: 'Admin Prices' },
    { name: 'Admin Bookings' },
    { name: 'Admin POS' },
    { name: 'Admin Payments' },
    { name: 'Admin Reports' },
    { name: 'Admin Users' },
    { name: 'Admin Roles' },
    { name: 'Admin Agents' },
    { name: 'Admin Notifications' },
    { name: 'Admin Settings' }
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
    schemas: {
      CustomerAuthRequest: customerAuthRequestSchema,
      AdminAuthRequest: adminAuthRequestSchema,
      BookingDraftRequest: bookingDraftSchema,
      BookingUpdateRequest: bookingUpdateSchema,
      PriceRuleRequest: priceRuleSchema,
      AuthSession: authSessionSchema
    }
  },
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'API root metadata',
        responses: {
          200: successResponse('Root metadata loaded')
        }
      }
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: successResponse('Health check OK')
        }
      }
    },
    '/docs': {
      get: {
        tags: ['System'],
        summary: 'Swagger UI',
        responses: {
          200: {
            description: 'Swagger UI HTML',
            ...textHtml('<!DOCTYPE html>')
          }
        }
      }
    },
    '/docs/openapi.json': {
      get: {
        tags: ['System'],
        summary: 'OpenAPI JSON document',
        responses: {
          200: successResponse('OpenAPI document')
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register customer user',
        requestBody: jsonContent({ $ref: '#/components/schemas/CustomerAuthRequest' }),
        responses: {
          201: successResponse('User registered')
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login customer user with Supabase Auth',
        requestBody: jsonContent({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' }
          }
        }),
        responses: {
          200: successResponse('Login successful')
        }
      }
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request customer password reset',
        requestBody: jsonContent({
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' }
          }
        }),
        responses: {
          200: successResponse('Password reset requested')
        }
      }
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset customer password',
        requestBody: jsonContent({
          type: 'object',
          required: ['token', 'new_password'],
          properties: {
            token: { type: 'string' },
            new_password: { type: 'string', format: 'password' }
          }
        }),
        responses: {
          200: successResponse('Password reset successful')
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current customer profile',
        security: authSecurity,
        responses: {
          200: successResponse('Profile loaded')
        }
      }
    },
    '/api/auth/profile/image': {
      post: {
        tags: ['Auth'],
        summary: 'Upload customer profile image',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['image_base64'],
          properties: {
            image_base64: { type: 'string' },
            mime_type: { type: 'string', nullable: true },
            file_name: { type: 'string', nullable: true }
          }
        }),
        responses: {
          200: successResponse('Profile image updated')
        }
      }
    },
    '/api/ticket-types': {
      get: {
        tags: ['Catalog'],
        summary: 'List ticket types',
        responses: {
          200: successResponse('Ticket types loaded')
        }
      }
    },
    '/api/ticket-types/{id}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get ticket type detail',
        parameters: [{
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }],
        responses: {
          200: successResponse('Ticket type loaded')
        }
      }
    },
    '/api/schedules': {
      get: {
        tags: ['Catalog'],
        summary: 'List schedules',
        responses: {
          200: successResponse('Schedules loaded')
        }
      }
    },
    '/api/schedules/{id}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get schedule detail',
        parameters: [{
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }],
        responses: {
          200: successResponse('Schedule loaded')
        }
      }
    },
    '/api/bookings/draft': {
      post: {
        tags: ['Bookings'],
        summary: 'Create booking draft',
        security: authSecurity,
        requestBody: jsonContent({ $ref: '#/components/schemas/BookingDraftRequest' }),
        responses: {
          201: successResponse('Booking draft created')
        }
      }
    },
    '/api/bookings/my': {
      get: {
        tags: ['Bookings'],
        summary: 'List current customer bookings',
        security: authSecurity,
        responses: {
          200: successResponse('Bookings loaded')
        }
      }
    },
    '/api/bookings/me': {
      get: {
        tags: ['Bookings'],
        summary: 'Alias of current customer bookings',
        security: authSecurity,
        responses: {
          200: successResponse('Bookings loaded')
        }
      }
    },
    '/api/bookings/{bookingNo}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get booking detail by booking number',
        parameters: [{
          name: 'bookingNo',
          in: 'path',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: successResponse('Booking loaded')
        }
      },
      put: {
        tags: ['Bookings'],
        summary: 'Update booking contact and passengers',
        requestBody: jsonContent({ $ref: '#/components/schemas/BookingUpdateRequest' }),
        responses: {
          200: successResponse('Booking updated')
        }
      }
    },
    '/api/bookings/jobs/expire-stale': {
      post: {
        tags: ['Bookings'],
        summary: 'Expire stale bookings manually',
        security: internalApiSecurity,
        responses: {
          200: successResponse('Expired stale bookings')
        }
      }
    },
    '/api/payments': {
      post: {
        tags: ['Payments'],
        summary: 'Create payment for booking',
        requestBody: jsonContent({
          type: 'object',
          required: ['booking_no', 'method'],
          properties: {
            booking_no: { type: 'string' },
            method: { type: 'string' },
            amount: { type: 'number', nullable: true }
          }
        }),
        responses: {
          201: successResponse('Payment created')
        }
      }
    },
    '/api/payments/{paymentRef}': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment detail',
        parameters: [{
          name: 'paymentRef',
          in: 'path',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: successResponse('Payment loaded')
        }
      }
    },
    '/api/payments/webhook/callback': {
      post: {
        tags: ['Payments'],
        summary: 'Receive payment webhook callback',
        security: webhookSecurity,
        responses: {
          200: successResponse('Webhook handled')
        }
      }
    },
    '/api/tickets/booking/{bookingNo}': {
      get: {
        tags: ['Tickets'],
        summary: 'Get tickets by booking number',
        parameters: [{
          name: 'bookingNo',
          in: 'path',
          required: true,
          schema: { type: 'string' }
        }],
        responses: {
          200: successResponse('Tickets loaded')
        }
      }
    },
    '/api/tickets/resend': {
      post: {
        tags: ['Tickets'],
        summary: 'Resend tickets',
        security: internalApiSecurity,
        responses: {
          200: successResponse('Tickets resent')
        }
      }
    },
    '/api/gate/validate': {
      post: {
        tags: ['Gate'],
        summary: 'Validate ticket at gate',
        security: internalApiSecurity,
        requestBody: jsonContent({
          type: 'object',
          properties: {
            qr_token: { type: 'string', nullable: true },
            ticket_no: { type: 'string', nullable: true }
          }
        }),
        responses: {
          200: successResponse('Validation complete')
        }
      }
    },
    '/api/notifications/send': {
      post: {
        tags: ['Notifications'],
        summary: 'Send notification via internal API',
        security: internalApiSecurity,
        responses: {
          200: successResponse('Notification sent')
        }
      }
    },
    '/api/admin/auth/login': {
      post: {
        tags: ['Admin Auth'],
        summary: 'Login admin user with Supabase Auth',
        requestBody: jsonContent({ $ref: '#/components/schemas/AdminAuthRequest' }),
        responses: {
          200: successResponse('Admin login successful')
        }
      }
    },
    '/api/admin/auth/forgot-password': {
      post: {
        tags: ['Admin Auth'],
        summary: 'Request admin password reset',
        requestBody: jsonContent({
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' }
          }
        }),
        responses: {
          200: successResponse('Password reset requested')
        }
      }
    },
    '/api/admin/auth/reset-password': {
      post: {
        tags: ['Admin Auth'],
        summary: 'Reset admin password',
        requestBody: jsonContent({
          type: 'object',
          required: ['token', 'new_password'],
          properties: {
            token: { type: 'string' },
            new_password: { type: 'string', format: 'password' }
          }
        }),
        responses: {
          200: successResponse('Password reset successful')
        }
      }
    },
    '/api/admin/auth/me': {
      get: {
        tags: ['Admin Auth'],
        summary: 'Get current admin profile',
        security: authSecurity,
        responses: {
          200: successResponse('Admin profile loaded')
        }
      }
    },
    '/api/admin/permissions': {
      get: {
        tags: ['Admin Auth'],
        summary: 'Get permissions catalog',
        security: authSecurity,
        responses: {
          200: successResponse('Permissions loaded')
        }
      }
    },
    '/api/admin/dashboard': {
      get: {
        tags: ['Admin Dashboard'],
        summary: 'Get dashboard summary',
        security: authSecurity,
        responses: {
          200: successResponse('Dashboard loaded')
        }
      }
    },
    '/api/admin/schedules': {
      get: {
        tags: ['Admin Schedules'],
        summary: 'List schedules for admin',
        security: authSecurity,
        responses: { 200: successResponse('Schedules loaded') }
      },
      post: {
        tags: ['Admin Schedules'],
        summary: 'Create schedule',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['trip_date', 'departure_time', 'capacity'],
          properties: {
            trip_date: { type: 'string', format: 'date' },
            departure_time: { type: 'string' },
            arrival_time: { type: 'string', nullable: true },
            capacity: { type: 'integer' },
            vessel_id: { type: 'string', format: 'uuid', nullable: true },
            route_name: { type: 'string', nullable: true },
            pier_name: { type: 'string', nullable: true }
          }
        }),
        responses: { 201: successResponse('Schedule created') }
      }
    },
    '/api/admin/schedules/{id}': {
      get: {
        tags: ['Admin Schedules'],
        summary: 'Get schedule detail',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: successResponse('Schedule loaded') }
      },
      put: {
        tags: ['Admin Schedules'],
        summary: 'Update schedule',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            trip_date: { type: 'string', format: 'date' },
            departure_time: { type: 'string' },
            arrival_time: { type: 'string', nullable: true },
            capacity: { type: 'integer' },
            status: { type: 'string' }
          }
        }),
        responses: { 200: successResponse('Schedule updated') }
      }
    },
    '/api/admin/schedules/{id}/open-sales': {
      post: {
        tags: ['Admin Schedules'],
        summary: 'Open sales for schedule',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: successResponse('Schedule opened') }
      }
    },
    '/api/admin/schedules/{id}/close-sales': {
      post: {
        tags: ['Admin Schedules'],
        summary: 'Close sales for schedule',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: successResponse('Schedule closed') }
      }
    },
    '/api/admin/schedules/{id}/cancel': {
      post: {
        tags: ['Admin Schedules'],
        summary: 'Cancel schedule',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            reason: { type: 'string', nullable: true }
          }
        }),
        responses: { 200: successResponse('Schedule cancelled') }
      }
    },
    '/api/admin/ticket-types': {
      get: {
        tags: ['Admin Ticket Types'],
        summary: 'List ticket types',
        security: authSecurity,
        responses: { 200: successResponse('Ticket types loaded') }
      },
      post: {
        tags: ['Admin Ticket Types'],
        summary: 'Create ticket type',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['code', 'name_th'],
          properties: {
            code: { type: 'string' },
            name_th: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 201: successResponse('Ticket type created') }
      }
    },
    '/api/admin/ticket-types/{id}': {
      put: {
        tags: ['Admin Ticket Types'],
        summary: 'Update ticket type',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            name_th: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true },
            requires_document: { type: 'boolean', nullable: true }
          }
        }),
        responses: { 200: successResponse('Ticket type updated') }
      }
    },
    '/api/admin/prices/standard': {
      get: {
        tags: ['Admin Prices'],
        summary: 'List standard price rules',
        security: authSecurity,
        responses: { 200: successResponse('Standard prices loaded') }
      },
      post: {
        tags: ['Admin Prices'],
        summary: 'Create standard price rule',
        security: authSecurity,
        requestBody: jsonContent({ $ref: '#/components/schemas/PriceRuleRequest' }),
        responses: { 201: successResponse('Standard price created') }
      }
    },
    '/api/admin/prices/standard/{id}': {
      put: {
        tags: ['Admin Prices'],
        summary: 'Update standard price rule',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({ $ref: '#/components/schemas/PriceRuleRequest' }),
        responses: { 200: successResponse('Standard price updated') }
      }
    },
    '/api/admin/prices/agent': {
      get: {
        tags: ['Admin Prices'],
        summary: 'List agent price rules',
        security: authSecurity,
        responses: { 200: successResponse('Agent prices loaded') }
      },
      post: {
        tags: ['Admin Prices'],
        summary: 'Create agent price rule',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['agent_id', 'ticket_type_id', 'price', 'valid_from'],
          properties: {
            agent_id: { type: 'string', format: 'uuid' },
            ticket_type_id: { type: 'string', format: 'uuid' },
            price: { type: 'number' },
            valid_from: { type: 'string', format: 'date' },
            valid_to: { type: 'string', format: 'date', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 201: successResponse('Agent price created') }
      }
    },
    '/api/admin/prices/agent/{id}': {
      put: {
        tags: ['Admin Prices'],
        summary: 'Update agent price rule',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            price: { type: 'number' },
            valid_from: { type: 'string', format: 'date' },
            valid_to: { type: 'string', format: 'date', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 200: successResponse('Agent price updated') }
      }
    },
    '/api/admin/prices/preview': {
      get: {
        tags: ['Admin Prices'],
        summary: 'Preview resolved price',
        security: authSecurity,
        responses: { 200: successResponse('Price preview loaded') }
      }
    },
    '/api/admin/bookings': {
      get: {
        tags: ['Admin Bookings'],
        summary: 'List bookings',
        security: authSecurity,
        responses: { 200: successResponse('Bookings loaded') }
      }
    },
    '/api/admin/bookings/{bookingNo}': {
      get: {
        tags: ['Admin Bookings'],
        summary: 'Get booking detail',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Booking loaded') }
      },
      put: {
        tags: ['Admin Bookings'],
        summary: 'Update booking',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            contact_name: { type: 'string', nullable: true },
            contact_phone: { type: 'string', nullable: true },
            contact_email: { type: 'string', format: 'email', nullable: true }
          }
        }),
        responses: { 200: successResponse('Booking updated') }
      }
    },
    '/api/admin/bookings/{bookingNo}/change-schedule': {
      post: {
        tags: ['Admin Bookings'],
        summary: 'Change booking schedule',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: jsonContent({
          type: 'object',
          required: ['schedule_id'],
          properties: {
            schedule_id: { type: 'string', format: 'uuid' }
          }
        }),
        responses: { 200: successResponse('Booking rescheduled') }
      }
    },
    '/api/admin/bookings/{bookingNo}/cancel': {
      post: {
        tags: ['Admin Bookings'],
        summary: 'Cancel booking',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            reason: { type: 'string', nullable: true }
          }
        }),
        responses: { 200: successResponse('Booking cancelled') }
      }
    },
    '/api/admin/bookings/{bookingNo}/mark-paid': {
      post: {
        tags: ['Admin Bookings'],
        summary: 'Mark booking as paid',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Booking payment confirmed') }
      }
    },
    '/api/admin/bookings/{bookingNo}/resend-tickets': {
      post: {
        tags: ['Admin Bookings'],
        summary: 'Resend booking tickets',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Tickets resent') }
      }
    },
    '/api/admin/bookings/{bookingNo}/refund': {
      post: {
        tags: ['Admin Bookings'],
        summary: 'Refund booking',
        security: authSecurity,
        parameters: [{ name: 'bookingNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Booking refunded') }
      }
    },
    '/api/admin/pos/sales': {
      post: {
        tags: ['Admin POS'],
        summary: 'Create walk-in POS sale',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['schedule_id', 'items', 'payment_method'],
          properties: {
            schedule_id: { type: 'string', format: 'uuid' },
            agent_id: { type: 'string', format: 'uuid', nullable: true },
            items: bookingDraftSchema.properties.items,
            payment_method: { type: 'string' },
            contact_name: { type: 'string', nullable: true },
            contact_phone: { type: 'string', nullable: true },
            contact_email: { type: 'string', format: 'email', nullable: true },
            passengers: bookingUpdateSchema.properties.passengers
          }
        }),
        responses: { 201: successResponse('Walk-in sale created') }
      }
    },
    '/api/admin/gate/search': {
      get: {
        tags: ['Gate'],
        summary: 'Search ticket for boarding',
        security: authSecurity,
        responses: { 200: successResponse('Tickets loaded') }
      }
    },
    '/api/admin/gate/scan': {
      post: {
        tags: ['Gate'],
        summary: 'Scan ticket at boarding gate',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          properties: {
            qr_token: { type: 'string', nullable: true },
            ticket_no: { type: 'string', nullable: true },
            schedule_id: { type: 'string', format: 'uuid', nullable: true }
          }
        }),
        responses: { 200: successResponse('Gate scan completed') }
      }
    },
    '/api/admin/payments': {
      get: {
        tags: ['Admin Payments'],
        summary: 'List payments',
        security: authSecurity,
        responses: { 200: successResponse('Payments loaded') }
      }
    },
    '/api/admin/payments/{paymentRef}': {
      get: {
        tags: ['Admin Payments'],
        summary: 'Get payment detail',
        security: authSecurity,
        parameters: [{ name: 'paymentRef', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Payment loaded') }
      }
    },
    '/api/admin/payments/{paymentRef}/confirm': {
      post: {
        tags: ['Admin Payments'],
        summary: 'Confirm payment manually',
        security: authSecurity,
        parameters: [{ name: 'paymentRef', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Payment confirmed') }
      }
    },
    '/api/admin/payments/{paymentRef}/refund': {
      post: {
        tags: ['Admin Payments'],
        summary: 'Refund payment manually',
        security: authSecurity,
        parameters: [{ name: 'paymentRef', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successResponse('Payment refunded') }
      }
    },
    '/api/admin/reports/sales': {
      get: {
        tags: ['Admin Reports'],
        summary: 'Sales report',
        security: authSecurity,
        responses: { 200: successResponse('Sales report loaded') }
      }
    },
    '/api/admin/reports/passengers': {
      get: {
        tags: ['Admin Reports'],
        summary: 'Passenger report',
        security: authSecurity,
        responses: { 200: successResponse('Passenger report loaded') }
      }
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin Users'],
        summary: 'List admin users',
        security: authSecurity,
        responses: { 200: successResponse('Admin users loaded') }
      },
      post: {
        tags: ['Admin Users'],
        summary: 'Create admin user',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['name', 'email', 'role', 'password'],
          properties: {
            name: { type: 'string' },
            username: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', nullable: true },
            role: { type: 'string' },
            password: { type: 'string', format: 'password' },
            status: { type: 'string', nullable: true },
            agent_id: { type: 'string', format: 'uuid', nullable: true }
          }
        }),
        responses: { 201: successResponse('Admin user created') }
      }
    },
    '/api/admin/users/{id}': {
      put: {
        tags: ['Admin Users'],
        summary: 'Update admin user',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            name: { type: 'string', nullable: true },
            username: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email', nullable: true },
            phone: { type: 'string', nullable: true },
            role: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 200: successResponse('Admin user updated') }
      }
    },
    '/api/admin/users/{id}/reset-password': {
      post: {
        tags: ['Admin Users'],
        summary: 'Reset managed admin password',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: successResponse('Admin user password reset') }
      }
    },
    '/api/admin/roles': {
      get: {
        tags: ['Admin Roles'],
        summary: 'List roles',
        security: authSecurity,
        responses: { 200: successResponse('Roles loaded') }
      },
      post: {
        tags: ['Admin Roles'],
        summary: 'Create role',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['code', 'name', 'permissions'],
          properties: {
            code: { type: 'string' },
            name: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
            description: { type: 'string', nullable: true }
          }
        }),
        responses: { 201: successResponse('Role created') }
      }
    },
    '/api/admin/roles/{code}': {
      put: {
        tags: ['Admin Roles'],
        summary: 'Update role',
        security: authSecurity,
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            name: { type: 'string', nullable: true },
            permissions: { type: 'array', items: { type: 'string' }, nullable: true },
            description: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 200: successResponse('Role updated') }
      }
    },
    '/api/admin/agents': {
      get: {
        tags: ['Admin Agents'],
        summary: 'List agents',
        security: authSecurity,
        responses: { 200: successResponse('Agents loaded') }
      },
      post: {
        tags: ['Admin Agents'],
        summary: 'Create agent',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            company_name: { type: 'string', nullable: true },
            contact_name: { type: 'string', nullable: true },
            contact_phone: { type: 'string', nullable: true },
            contact_email: { type: 'string', format: 'email', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 201: successResponse('Agent created') }
      }
    },
    '/api/admin/agents/{id}': {
      put: {
        tags: ['Admin Agents'],
        summary: 'Update agent',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: jsonContent({
          type: 'object',
          properties: {
            name: { type: 'string', nullable: true },
            company_name: { type: 'string', nullable: true },
            contact_name: { type: 'string', nullable: true },
            contact_phone: { type: 'string', nullable: true },
            contact_email: { type: 'string', format: 'email', nullable: true },
            status: { type: 'string', nullable: true }
          }
        }),
        responses: { 200: successResponse('Agent updated') }
      }
    },
    '/api/admin/agents/{id}/sales': {
      get: {
        tags: ['Admin Agents'],
        summary: 'Get agent sales summary',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: successResponse('Agent sales loaded') }
      }
    },
    '/api/admin/notifications': {
      get: {
        tags: ['Admin Notifications'],
        summary: 'List notifications',
        security: authSecurity,
        responses: { 200: successResponse('Notifications loaded') }
      },
      post: {
        tags: ['Admin Notifications'],
        summary: 'Create notification',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['subject', 'message'],
          properties: {
            subject: { type: 'string' },
            message: { type: 'string' },
            type: { type: 'string', nullable: true },
            priority: { type: 'string', nullable: true },
            target_path: { type: 'string', nullable: true }
          }
        }),
        responses: { 201: successResponse('Notification created') }
      }
    },
    '/api/admin/notifications/{id}/read': {
      post: {
        tags: ['Admin Notifications'],
        summary: 'Mark notification as read',
        security: authSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: successResponse('Notification marked as read') }
      }
    },
    '/api/admin/settings': {
      get: {
        tags: ['Admin Settings'],
        summary: 'List system settings',
        security: authSecurity,
        responses: { 200: successResponse('Settings loaded') }
      },
      put: {
        tags: ['Admin Settings'],
        summary: 'Update system settings',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['key', 'value'],
                properties: {
                  category: { type: 'string', nullable: true },
                  key: { type: 'string' },
                  value: {}
                }
              }
            }
          }
        }),
        responses: { 200: successResponse('Settings updated') }
      }
    },
    '/api/admin/settings/export': {
      get: {
        tags: ['Admin Settings'],
        summary: 'Export system settings',
        security: authSecurity,
        responses: { 200: successResponse('Settings exported') }
      }
    },
    '/api/admin/settings/import': {
      post: {
        tags: ['Admin Settings'],
        summary: 'Import system settings',
        security: authSecurity,
        requestBody: jsonContent({
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['key', 'value'],
                properties: {
                  category: { type: 'string', nullable: true },
                  key: { type: 'string' },
                  value: {}
                }
              }
            }
          }
        }),
        responses: { 200: successResponse('Settings imported') }
      }
    }
  }
};

export const buildOpenApiDocument = (serverUrl = env.appUrl) => ({
  ...openApiDocumentBase,
  servers: [{
    url: serverUrl
  }]
});

export const swaggerUiHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ferry Ticketing API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f5f7fb; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: '/docs/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          persistAuthorization: true
        });
      };
    </script>
  </body>
</html>`;
