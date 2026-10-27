import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Configures express-session backed by connect-mongo
 * @param {string} [mongoUrl]
 */
export function createSessionMiddleware(mongoUrl) {
  let store;

  if (mongoUrl) {
    store = MongoStore.create({
      mongoUrl,
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60
    });
  } else {
    store = MongoStore.create({
      clientPromise: new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) {
          resolve(mongoose.connection.getClient());
        } else {
          mongoose.connection.once('connected', () => {
            resolve(mongoose.connection.getClient());
          });
          mongoose.connection.once('error', (err) => {
            reject(err);
          });
        }
      }),
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60
    });
  }

  const isProduction = env.NODE_ENV === 'production';

  return session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  });
}
