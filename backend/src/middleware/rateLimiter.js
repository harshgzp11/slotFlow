import { TooManyRequestsError } from './errorHandler.js';

/**
 * Creates an in-memory sliding window rate limiter middleware
 *
 * @param {Object} options
 * @param {number} [options.windowMs=900000] - Window size in milliseconds (default 15 mins)
 * @param {number} [options.max=100] - Max requests allowed within windowMs per IP
 * @param {string} [options.message] - Custom error message
 * @param {boolean} [options.skipInTest=true] - Skip enforcement in test environment unless explicitly false
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 100;
  const message = options.message || 'Too many requests. Please try again later.';
  const skipInTest = options.skipInTest !== false;

  // Map of clientIp -> Array of timestamp numbers
  const hits = new Map();

  // Periodic cleanup every 5 minutes to prevent memory leaks from one-off IPs
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, 5 * 60 * 1000);

  // Unref timer so it does not block graceful process exit
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req, res, next) => {
    if (skipInTest && process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = hits.get(ip) || [];
    const recentHits = timestamps.filter((t) => t > cutoff);

    if (recentHits.length >= max) {
      const oldestHit = recentHits[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(new TooManyRequestsError(message, { retryAfterSeconds }));
    }

    recentHits.push(now);
    hits.set(ip, recentHits);
    next();
  };
}
