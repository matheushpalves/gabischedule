import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Config } from './config';
import type { Db } from './db';
import { authRoutes } from './auth/routes';
import type { AuthStore } from './auth/store';
import { errorHandler } from './lib/http';
import { taskRoutes } from './routes/tasks';
import { eventRoutes } from './routes/events';
import { reminderRoutes } from './routes/reminders';
import { kanbanRoutes } from './routes/kanban';
import { financeRoutes } from './routes/finance';

export interface AppDeps {
  config: Pick<Config, 'AUTH_BASE' | 'COOKIE_SECURE' | 'TRUST_PROXY'> & Partial<Config>;
  authStore: AuthStore;
  /** Opcional nos testes de autenticação: sem banco, só as rotas de /api/auth são registradas. */
  db?: Db;
  now?: () => Date;
  logger?: boolean;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger ?? false,
    trustProxy: deps.config.TRUST_PROXY.split(',').map((s) => s.trim()),
    bodyLimit: 64 * 1024,
  });

  await app.register(cookie);
  app.setErrorHandler((err, _req, reply) => errorHandler(err as Error & { statusCode?: number }, reply));

  await authRoutes(app, {
    store: deps.authStore,
    authBase: deps.config.AUTH_BASE,
    cookieSecure: deps.config.COOKIE_SECURE,
    now: deps.now,
  });

  app.get('/api/health', async () => ({ ok: true }));

  // Tudo abaixo exige sessão válida.
  await app.register(async (secured) => {
    secured.addHook('onRequest', secured.requireSession);
    if (deps.db) {
      const db = deps.db;
      const config = deps.config as Config;
      await secured.register(taskRoutes, { db });
      await secured.register(eventRoutes, { db });
      await secured.register(reminderRoutes, { db, config });
      await secured.register(kanbanRoutes, { db });
      await secured.register(financeRoutes, { db });
    }
    // Qualquer outra rota /api/* (com sessão) → 404 em JSON.
    secured.all('/api/*', async (_req, reply) => reply.code(404).send({ error: 'Não encontrado' }));
  });

  return app;
}
