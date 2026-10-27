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

  // CORS Configuration
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
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
