// src/lib/crypto/tokens.ts
import crypto from 'crypto';

/**
 * Generates a cryptographically secure random token (minimum 32 bytes = 64 hex chars).
 */
export function generateSecureShareToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashShareToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes SHA-256 hash of a raw token for safe database storage.
 */
export function hashShareToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
