import { describe, it, expect } from 'vitest';
import { validateEnv, DEV_DEFAULT_SESSION_SECRET } from '../../src/config/env.js';

describe('Production Session Security (Finding 1)', () => {
  const baseValidEnv = {
    PORT: '5000',
    CLIENT_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://localhost:27017/slotflow_test'
  };

  it('fails fast in production when SESSION_SECRET is missing', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: 'production'
      })
    ).toThrow(/SESSION_SECRET is required in production/);
  });

  it('fails fast in production when SESSION_SECRET is blank whitespace', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: '   '
      })
    ).toThrow(/SESSION_SECRET is required in production/);
  });

  it('fails fast in production when SESSION_SECRET uses the development default fallback', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: DEV_DEFAULT_SESSION_SECRET
      })
    ).toThrow(/Production cannot use the default development SESSION_SECRET/);
  });

  it('fails fast in production when SESSION_SECRET is shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: 'production',
        SESSION_SECRET: 'too_short_secret_under_32_chars'
      })
    ).toThrow(/at least 32 characters/);
  });

  it('passes in production when SESSION_SECRET is a strong, non-default 32+ character key', () => {
    const strongSecret = 'super_secret_production_key_that_is_long_and_secure_64_bits';
    const parsed = validateEnv({
      ...baseValidEnv,
      NODE_ENV: 'production',
      SESSION_SECRET: strongSecret
    });

    expect(parsed.SESSION_SECRET).toBe(strongSecret);
    expect(parsed.NODE_ENV).toBe('production');
  });

  it('provides convenient development default in development when SESSION_SECRET is not provided', () => {
    const parsed = validateEnv({
      ...baseValidEnv,
      NODE_ENV: 'development'
    });

    expect(parsed.SESSION_SECRET).toBe(DEV_DEFAULT_SESSION_SECRET);
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('provides convenient development default in test when SESSION_SECRET is not provided', () => {
    const parsed = validateEnv({
      ...baseValidEnv,
      NODE_ENV: 'test'
    });

    expect(parsed.SESSION_SECRET).toBe(DEV_DEFAULT_SESSION_SECRET);
    expect(parsed.NODE_ENV).toBe('test');
  });
});

describe('ENABLE_BACKGROUND_WORKER Configuration Parsing', () => {
  const baseValidEnv = {
    PORT: '5000',
    CLIENT_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://localhost:27017/slotflow_test',
    NODE_ENV: 'test'
  };

  it('defaults to true when ENABLE_BACKGROUND_WORKER is omitted', () => {
    const parsed = validateEnv({ ...baseValidEnv });
    expect(parsed.ENABLE_BACKGROUND_WORKER).toBe(true);
  });

  it('parses string "true" into boolean true', () => {
    const parsed = validateEnv({ ...baseValidEnv, ENABLE_BACKGROUND_WORKER: 'true' });
    expect(parsed.ENABLE_BACKGROUND_WORKER).toBe(true);
    expect(typeof parsed.ENABLE_BACKGROUND_WORKER).toBe('boolean');
  });

  it('parses string "false" into boolean false', () => {
    const parsed = validateEnv({ ...baseValidEnv, ENABLE_BACKGROUND_WORKER: 'false' });
    expect(parsed.ENABLE_BACKGROUND_WORKER).toBe(false);
    expect(typeof parsed.ENABLE_BACKGROUND_WORKER).toBe('boolean');
  });

  it('preserves native boolean true and false', () => {
    expect(validateEnv({ ...baseValidEnv, ENABLE_BACKGROUND_WORKER: true }).ENABLE_BACKGROUND_WORKER).toBe(true);
    expect(validateEnv({ ...baseValidEnv, ENABLE_BACKGROUND_WORKER: false }).ENABLE_BACKGROUND_WORKER).toBe(false);
  });

  it('parses string "1" and "0" correctly', () => {
    expect(validateEnv({ ...baseValidEnv, ENABLE_BACKGROUND_WORKER: '1' }).ENABLE_BACKGROUND_WORKER).toBe(true);
    expect(validateEnv({ ...baseValidEnv, ENABLE_BACKGROUND_WORKER: '0' }).ENABLE_BACKGROUND_WORKER).toBe(false);
  });
});
