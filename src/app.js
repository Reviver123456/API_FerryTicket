import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import ticketTypeRoutes from './routes/ticketType.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import roleRoutes from './routes/role.routes.js';
import priceRoutes from './routes/price.routes.js';
import reportRoutes from './routes/report.routes.js';
import posRoutes from './routes/pos.routes.js';
import agentRoutes from './routes/agent.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import userRoutes from './routes/user.routes.js';
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
const defaultCors = cors(corsOptions);
const openApiCors = cors();
const rootEndpoints = [
  'GET /',
  'GET /health',
  'GET /docs',
  'GET /docs/openapi.json',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'GET /api/auth/me',
  'PUT /api/auth/me',
  'POST /api/auth/me/profile-image',
  'POST /api/auth/logout',
  'GET /api/roles',
  'GET /api/permissions',
  'GET /api/ticket-types',
  'POST /api/ticket-types',
  'GET /api/schedules',
  'POST /api/schedules',
  'GET /api/prices',
  'POST /api/bookings/draft',
  'GET /api/bookings',
  'PUT /api/bookings/:bookingNo',
  'POST /api/payments',
  'GET /api/payments',
  'POST /api/payments/webhook/callback',
  'GET /api/tickets',
  'GET /api/notifications',
  'GET /api/dashboard',
  'GET /api/reports/sales',
  'POST /api/pos/sales',
  'GET /api/agents',
  'GET /api/settings',
  'GET /api/users'
];
const openApiDocumentCache = new Map();

app.use(requestContext);
app.use((req, res, next) => {
  if (req.path === '/docs' || req.path === '/docs/openapi.json') {
    return docsHelmet(req, res, next);
  }
  return defaultHelmet(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/docs/openapi.json') {
    return openApiCors(req, res, next);
  }
  return defaultCors(req, res, next);
});
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(createRateLimiter({
  keyPrefix: 'global',
  windowMs: env.rateLimitWindowMs,
  maxRequests: env.rateLimitMaxRequests
}));

app.get('/', (req, res) => ok(res, {
  name: 'Ferry Ticketing API',
  version: '2.0.0',
  endpoints: rootEndpoints
}));

app.get('/docs/openapi.json', (req, res) => {
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  const cachedDocument =
    openApiDocumentCache.get(serverUrl) ||
    buildOpenApiDocument(serverUrl);

  if (!openApiDocumentCache.has(serverUrl)) {
    openApiDocumentCache.set(serverUrl, cachedDocument);
  }

  res.set('Access-Control-Allow-Origin', '*');
  return res.json(cachedDocument);
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
app.use('/api', roleRoutes);
app.use('/api/ticket-types', ticketTypeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', reportRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);
