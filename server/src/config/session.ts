import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { env } from './env';

export function createSessionMiddleware(mongoUrl?: string) {
  let store: any;

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
          resolve(mongoose.connection.getClient() as any);
        } else {
          mongoose.connection.once('connected', () => {
            resolve(mongoose.connection.getClient() as any);
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

  return session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  });
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
    activeBusinessId?: string;
  }
}
