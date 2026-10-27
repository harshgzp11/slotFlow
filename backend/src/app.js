import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { createSessionMiddleware } from './config/session.js';
import apiRouter from './routes/index.js';
import { errorHandler, NotFoundError } from './middleware/errorHandler.js';

export function createApp(mongoUrl) {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );

  // Enable proxy trust for production reverse proxies (Render, Railway, Vercel, Fly.io, etc.)
  if (env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Parse allowed origins (supports comma-separated list, trims whitespace and trailing slashes)
  const allowedOrigins = (env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, supertest)
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }
        // In non-production environments, allow localhost / 127.0.0.1 origins for development flexibility
        if (
          env.NODE_ENV !== 'production' &&
          (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) || allowedOrigins.includes('*'))
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-business-id']
    })
  );

  // Platform root & health probes (Render, Vercel, ALB)
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'SlotFlow API',
      status: 'ok',
      version: '1.0.0',
      apiPrefix: '/api/v1'
    });
  });

  app.get('/health', (_req, res) => {
    res.redirect(307, '/api/v1/health');
  });

  // Body Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Session Middleware
  app.use(createSessionMiddleware(mongoUrl));

  // API Routes
  app.use('/api/v1', apiRouter);

  // 404 Catch-All
  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
