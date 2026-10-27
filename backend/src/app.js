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
        if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-business-id']
    })
  );

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
