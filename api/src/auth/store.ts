import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db';
import { HISTORY_MS, type Attempt } from './lockout';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Persistência usada pela autenticação (Postgres em produção, memória nos testes). */
export interface AuthStore {
  recentAttempts(ip: string, now: Date): Promise<Attempt[]>;
  recordAttempt(ip: string, success: boolean, at: Date): Promise<void>;
  createSession(tokenHash: string, expiresAt: Date): Promise<void>;
  isSessionValid(tokenHash: string, now: Date): Promise<boolean>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
}

export function pgAuthStore(db: Db): AuthStore {
  return {
    async recentAttempts(ip, now) {
      const { rows } = await db.query<{ success: boolean; created_at: Date }>(
        `SELECT success, created_at FROM login_attempts
         WHERE ip = $1 AND created_at > $2 ORDER BY created_at ASC, id ASC`,
        [ip, new Date(now.getTime() - HISTORY_MS)],
      );
      return rows.map((r) => ({ success: r.success, at: r.created_at }));
    },
    async recordAttempt(ip, success, at) {
      await db.query('INSERT INTO login_attempts (ip, success, created_at) VALUES ($1, $2, $3)', [ip, success, at]);
    },
    async createSession(tokenHash, expiresAt) {
      await db.query('INSERT INTO sessions (token_hash, expires_at) VALUES ($1, $2)', [tokenHash, expiresAt]);
    },
    async isSessionValid(tokenHash, now) {
      const { rowCount } = await db.query(
        'SELECT 1 FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2',
        [tokenHash, now],
      );
      return (rowCount ?? 0) > 0;
    },
    async revokeSession(tokenHash, now) {
      await db.query('UPDATE sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash, now]);
    },
  };
}

export function memoryAuthStore(): AuthStore & { attempts: Map<string, Attempt[]> } {
  const attempts = new Map<string, Attempt[]>();
  const sessions = new Map<string, { expiresAt: Date; revoked: boolean }>();
  return {
    attempts,
    async recentAttempts(ip, now) {
      return (attempts.get(ip) ?? []).filter((a) => a.at.getTime() > now.getTime() - HISTORY_MS);
    },
    async recordAttempt(ip, success, at) {
      attempts.set(ip, [...(attempts.get(ip) ?? []), { success, at }]);
    },
    async createSession(tokenHash, expiresAt) {
      sessions.set(tokenHash, { expiresAt, revoked: false });
    },
    async isSessionValid(tokenHash, now) {
      const s = sessions.get(tokenHash);
      return !!s && !s.revoked && s.expiresAt > now;
    },
    async revokeSession(tokenHash) {
      const s = sessions.get(tokenHash);
      if (s) s.revoked = true;
    },
  };
}
