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
import { ok } from './utils/http.js';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import { requestContext } from './middleware/requestContext.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { supabase } from './config/supabase.js';

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

app.use(requestContext);
app.use(helmet());
app.use(cors(corsOptions));
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
    'POST /api/auth/profile/image',
    'GET /api/ticket-types',
    'GET /api/schedules',
    'POST /api/bookings/draft',
    'PUT /api/bookings/:bookingNo',
    'POST /api/payments',
    'POST /api/payments/webhook/callback',
    'GET /api/tickets/booking/:bookingNo',
    'POST /api/gate/validate'
  ]
}));

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

app.use(errorHandler);
