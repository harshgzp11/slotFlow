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
