import mongoose from 'mongoose';
import { logger } from './logger';

export async function connectDB(uri: string): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true
    });
    logger.info(`MongoDB connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
