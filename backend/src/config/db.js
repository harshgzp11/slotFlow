import mongoose from 'mongoose';
import dns from 'dns';
import { logger } from './logger.js';

// Configure public DNS resolvers to prevent Windows SRV lookup failures (querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {
  // Ignore in environments where setServers is restricted
}

/**
 * Normalizes MongoDB URI by URL-encoding special characters in password
 * @param {string} uri
 * @returns {string}
 */
function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string' || !uri.startsWith('mongodb')) {
    return uri;
  }
  const parts = uri.split('://');
  if (parts.length !== 2) return uri;
  const afterProto = parts[1];
  const slashIdx = afterProto.indexOf('/');
  const authAndHost = slashIdx !== -1 ? afterProto.slice(0, slashIdx) : afterProto;
  const pathAndQuery = slashIdx !== -1 ? afterProto.slice(slashIdx) : '';
  const atLastIdx = authAndHost.lastIndexOf('@');
  if (atLastIdx === -1) return uri;
  const userPass = authAndHost.slice(0, atLastIdx);
  const host = authAndHost.slice(atLastIdx + 1);
  const colonIdx = userPass.indexOf(':');
  if (colonIdx === -1) return uri;
  const username = userPass.slice(0, colonIdx);
  let password = userPass.slice(colonIdx + 1);
  try {
    password = decodeURIComponent(password);
  } catch (_) {}
  const encodedPass = encodeURIComponent(password);
  return `${parts[0]}://${username}:${encodedPass}@${host}${pathAndQuery}`;
}

/**
 * Connects to MongoDB with Mongoose
 * @param {string} uri
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri) {
  const sanitizedUri = sanitizeMongoUri(uri);
  try {
    const conn = await mongoose.connect(sanitizedUri, {
      autoIndex: true
    });
    console.log('Connected to MongoDB');
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
