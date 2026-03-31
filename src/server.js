import { app } from './app.js';
import { env } from './config/env.js';
import { startBookingExpiryJob } from './jobs/bookingExpiry.job.js';

const server = app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
const stopBookingExpiryJob = startBookingExpiryJob();

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  stopBookingExpiryJob();

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
