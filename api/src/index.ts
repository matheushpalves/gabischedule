import { buildApp } from './app';
import { pgAuthStore } from './auth/store';
import { loadConfig } from './config';
import { createPool } from './db';
import { migrate } from './migrate';
import { configurePush, pushEnabled, startReminderCron } from './reminders/push';

const config = loadConfig();
const db = createPool(config.DATABASE_URL);
await migrate(db);

const app = await buildApp({ config, db, authStore: pgAuthStore(db), logger: true });
configurePush(config);
if (!pushEnabled(config)) app.log.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes: notificações push desativadas');
const task = startReminderCron(db, app.log);

// Limpeza diária de tentativas e sessões antigas.
setInterval(
  () => {
    db.query(`DELETE FROM login_attempts WHERE created_at < now() - interval '7 days'`).catch(() => {});
    db.query(`DELETE FROM sessions WHERE expires_at < now() OR revoked_at < now() - interval '7 days'`).catch(() => {});
  },
  24 * 60 * 60 * 1000,
).unref();

await app.listen({ port: config.PORT, host: config.HOST });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await task.stop();
    await app.close();
    await db.end();
    process.exit(0);
  });
}
