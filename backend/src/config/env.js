import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// Normalize MONGO_URI / MONGODB_URI alias if defined
if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
  process.env.MONGODB_URI = process.env.MONGO_URI;
}

export const DEV_DEFAULT_SESSION_SECRET =
  'slotflow_development_secret_key_minimum_32_characters_long_for_security';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z
      .union([z.string(), z.number()])
      .default('5000')
      .transform((val) => (typeof val === 'number' ? val : parseInt(val, 10))),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    MONGODB_URI: z.string().default('mongodb://localhost:27017/slotflow'),
    SESSION_SECRET: z.string().optional(),
    REDIS_URL: z.string().optional(),
    EMAIL_PROVIDER_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('notifications@slotflow.app'),
    ENABLE_BACKGROUND_WORKER: z
      .union([z.string(), z.boolean()])
      .default(true)
      .transform((val) => val === true || val === 'true'),
    WORKER_INTERVAL_MS: z
      .union([z.string(), z.number()])
      .default(15000)
      .transform((val) => (typeof val === 'number' ? val : parseInt(val, 10)))
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.SESSION_SECRET || !data.SESSION_SECRET.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET is required in production environment.'
        });
      } else if (data.SESSION_SECRET === DEV_DEFAULT_SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'Production cannot use the default development SESSION_SECRET.'
        });
      } else if (data.SESSION_SECRET.trim().length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'Production SESSION_SECRET must be at least 32 characters long for security.'
        });
      }
    }
  })
  .transform((data) => {
    if (data.NODE_ENV !== 'production' && !data.SESSION_SECRET) {
      return {
        ...data,
        SESSION_SECRET: DEV_DEFAULT_SESSION_SECRET
      };
    }
    return data;
  });

export function validateEnv(rawEnv = process.env) {
  return envSchema.parse(rawEnv);
}

export const env = validateEnv(process.env);

