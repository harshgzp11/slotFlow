import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { hashClaimToken, verifyClaimToken } from '../../src/services/recovery.service.js';

describe('Waitlist Token Verification (Finding 6)', () => {
  it('correctly validates a matching raw token against stored SHA-256 hash using constant-time comparison', () => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const storedHash = hashClaimToken(rawToken);

    expect(verifyClaimToken(storedHash, rawToken)).toBe(true);
  });

  it('rejects an invalid raw token', () => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const storedHash = hashClaimToken(rawToken);
    const tamperedToken = crypto.randomBytes(24).toString('hex');

    expect(verifyClaimToken(storedHash, tamperedToken)).toBe(false);
  });

  it('rejects an empty or missing token safely without throwing errors', () => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const storedHash = hashClaimToken(rawToken);

    expect(verifyClaimToken(storedHash, '')).toBe(false);
    expect(verifyClaimToken(storedHash, null)).toBe(false);
    expect(verifyClaimToken('', rawToken)).toBe(false);
    expect(verifyClaimToken(null, rawToken)).toBe(false);
  });

  it('rejects a malformed stored hash length safely', () => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const invalidShortHash = 'abcd1234ef56';

    expect(verifyClaimToken(invalidShortHash, rawToken)).toBe(false);
  });
});
