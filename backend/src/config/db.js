import mongoose from 'mongoose';
import { logger } from './logger.js';

/**
 * Connects to MongoDB with Mongoose
 * @param {string} uri
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri) {
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

/**
 * Disconnects from MongoDB
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
