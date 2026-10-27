import { createApp } from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { logger } from './config/logger';

async function bootstrap() {
  try {
    logger.info('Starting SlotFlow Server...');
    await connectDB(env.MONGODB_URI);

    const app = createApp(env.MONGODB_URI);

    const server = app.listen(env.PORT, () => {
      logger.info(`SlotFlow Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Bootstrap failed with fatal error:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
