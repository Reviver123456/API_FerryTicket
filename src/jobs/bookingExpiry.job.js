import { env } from '../config/env.js';
import { expireDraftBookings } from '../services/booking.service.js';

let bookingExpiryTimer = null;
let bookingExpiryRunning = false;

const runBookingExpiryCycle = async () => {
  if (bookingExpiryRunning) return;
  bookingExpiryRunning = true;

  try {
    const expiredBookings = await expireDraftBookings();
    const expiredCount = Array.isArray(expiredBookings) ? expiredBookings.length : 0;

    if (expiredCount > 0) {
      console.log(`[jobs] expired ${expiredCount} stale booking(s)`);
    }
  } catch (error) {
    console.error('[jobs] booking expiry job failed', error);
  } finally {
    bookingExpiryRunning = false;
  }
};

export const startBookingExpiryJob = () => {
  if (!env.bookingExpiryJobEnabled) {
    console.log('[jobs] booking expiry job disabled');
    return () => {};
  }

  if (bookingExpiryTimer) {
    return () => clearInterval(bookingExpiryTimer);
  }

  void runBookingExpiryCycle();
  bookingExpiryTimer = setInterval(() => {
    void runBookingExpiryCycle();
  }, env.bookingExpiryJobIntervalMs);
  bookingExpiryTimer.unref?.();

  console.log(`[jobs] booking expiry job started (interval ${env.bookingExpiryJobIntervalMs} ms)`);

  return () => {
    if (bookingExpiryTimer) {
      clearInterval(bookingExpiryTimer);
      bookingExpiryTimer = null;
      console.log('[jobs] booking expiry job stopped');
    }
  };
};
