import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './config/logger.js';
import { startRecoveryWorker } from './workers/recovery.worker.js';

async function bootstrap() {
  try {
    await connectDB(env.MONGODB_URI);

    const app = createApp(env.MONGODB_URI);

    let recoveryWorker = null;
    if (env.ENABLE_BACKGROUND_WORKER) {
      logger.info(`Starting in-process recovery worker (interval: ${env.WORKER_INTERVAL_MS}ms)...`);
      recoveryWorker = startRecoveryWorker({ intervalMs: env.WORKER_INTERVAL_MS });
    }

    const server = app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      if (recoveryWorker) {
        recoveryWorker.stop();
      }
      server.close(() => {
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
