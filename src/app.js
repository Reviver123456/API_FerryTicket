import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import ticketTypeRoutes from './routes/ticketType.routes.js';
import gateRoutes from './routes/gate.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { ok } from './utils/http.js';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import { requestContext } from './middleware/requestContext.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { supabase } from './config/supabase.js';
import { buildOpenApiDocument, swaggerUiHtml } from './docs/openapi.js';

export const app = express();

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.corsOrigins.length === 0 && !env.isProduction) return callback(null, true);
    if (env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  }
};

const defaultHelmet = helmet();
const docsHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      imgSrc: ["'self'", 'data:', 'https://unpkg.com'],
      fontSrc: ["'self'", 'data:', 'https://unpkg.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

app.use(requestContext);
app.use((req, res, next) => {
  if (req.path === '/docs' || req.path === '/docs/openapi.json') {
    return docsHelmet(req, res, next);
  }
  return defaultHelmet(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/docs/openapi.json') {
    return cors()(req, res, next);
  }
  return cors(corsOptions)(req, res, next);
});
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(createRateLimiter({
  keyPrefix: 'global',
  windowMs: env.rateLimitWindowMs,
  maxRequests: env.rateLimitMaxRequests
}));

app.get('/', (req, res) => ok(res, {
  name: 'Ferry Ticketing API',
  version: '1.0.0',
  endpoints: [
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'GET /api/auth/me',
    'POST /api/auth/profile/image',
    'GET /api/ticket-types',
    'GET /api/schedules',
    'POST /api/bookings/draft',
    'GET /api/bookings/my',
    'PUT /api/bookings/:bookingNo',
    'POST /api/payments',
    'POST /api/payments/webhook/callback',
    'GET /api/tickets/booking/:bookingNo',
    'POST /api/gate/validate',
    'POST /api/admin/auth/login',
    'GET /api/admin/dashboard',
    'GET /docs',
    'GET /docs/openapi.json'
  ]
}));

app.get('/docs/openapi.json', (req, res) => {
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  res.set('Access-Control-Allow-Origin', '*');
  return res.json(buildOpenApiDocument(serverUrl));
});

app.get('/docs', (req, res) => res.type('html').send(swaggerUiHtml));

app.get('/health', async (req, res, next) => {
  try {
    const { error } = await supabase.from('ticket_types').select('id').limit(1);
    if (error) throw error;

    return ok(res, {
      status: 'ok',
      uptime_seconds: Math.round(process.uptime()),
      timezone: env.timezone
    }, 'Health check OK');
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/ticket-types', ticketTypeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);
