import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema } from '@gabi/shared';
import { isValidCode } from './code';
import { lockedUntil } from './lockout';
import { SESSION_TTL_MS, hashToken, newToken, type AuthStore } from './store';

export const SESSION_COOKIE = 'gabi_session';

export interface AuthOptions {
  store: AuthStore;
  authBase: number;
  cookieSecure: boolean;
  now?: () => Date;
}

declare module 'fastify' {
  interface FastifyInstance {
    requireSession: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Registra /api/auth/* e o decorator `requireSession` usado pelas demais rotas. */
export async function authRoutes(app: FastifyInstance, opts: AuthOptions) {
  const now = opts.now ?? (() => new Date());
  const { store } = opts;

  const cookieOpts = {
    path: '/',
    httpOnly: true,
    secure: opts.cookieSecure,
    sameSite: 'strict' as const,
  };

  app.decorate('requireSession', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token || !(await store.isSessionValid(hashToken(token), now()))) {
      return reply.code(401).send({ error: 'Sessão expirada. Entre novamente.' });
    }
  });

  app.post('/api/auth/login', async (req, reply) => {
    const at = now();
    const ip = req.ip;
    const until = lockedUntil(await store.recentAttempts(ip, at), at);
    if (until) {
      const retryAfter = Math.ceil((until.getTime() - at.getTime()) / 1000);
      reply.header('Retry-After', String(retryAfter));
      return reply.code(429).send({
        error: 'Muitas tentativas. Tente novamente mais tarde.',
        retryAfter,
      });
    }

    const parsed = loginSchema.safeParse(req.body);
    const ok = parsed.success && isValidCode(parsed.data.code, opts.authBase, at);
    await store.recordAttempt(ip, ok, at);

    if (!ok) {
      const nowLocked = lockedUntil(await store.recentAttempts(ip, at), at);
      if (nowLocked) {
        const retryAfter = Math.ceil((nowLocked.getTime() - at.getTime()) / 1000);
        reply.header('Retry-After', String(retryAfter));
        return reply.code(429).send({ error: 'Código incorreto. Muitas tentativas: aguarde 15 minutos.', retryAfter });
      }
      return reply.code(401).send({ error: 'Código incorreto' });
    }

    const token = newToken();
    const expiresAt = new Date(at.getTime() + SESSION_TTL_MS);
    await store.createSession(hashToken(token), expiresAt);
    reply.setCookie(SESSION_COOKIE, token, { ...cookieOpts, expires: expiresAt });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await store.revokeSession(hashToken(token), now());
    reply.clearCookie(SESSION_COOKIE, cookieOpts);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: app.requireSession }, async () => ({ ok: true }));
}
