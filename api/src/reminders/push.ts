import cron from 'node-cron';
import webpush from 'web-push';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db';
import { nextOccurrence } from './schedule';
import { dispatchDueEventNotifications } from '../events/series';
import type { Repeat } from '@gabi/shared';

export function pushEnabled(config: Config): boolean {
  return Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
}

export function configurePush(config: Config) {
  if (pushEnabled(config)) {
    webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envia para todas as inscrições; remove as que expiraram (404/410). */
export async function sendToAll(db: Db, payload: PushPayload, log: FastifyBaseLogger): Promise<number> {
  const { rows } = await db.query<{ id: number; endpoint: string; p256dh: string; auth: string }>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions',
  );
  let sent = 0;
  await Promise.all(
    rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: 'high' },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
        } else {
          log.warn({ err, endpoint: s.endpoint.slice(0, 60) }, 'falha ao enviar push');
        }
      }
    }),
  );
  return sent;
}

interface DueRow {
  id: number;
  title: string;
  date: string;
  time: string;
  repeat: Repeat;
  interval_hours: number | null;
  next_at: Date;
}

/** Dispara lembretes vencidos e agenda a próxima ocorrência. */
export async function dispatchDueReminders(db: Db, log: FastifyBaseLogger, now = new Date()): Promise<number> {
  const client = await db.connect();
  let count = 0;
  try {
    await client.query('BEGIN');
    // SKIP LOCKED evita disparo duplo caso dois processos rodem ao mesmo tempo.
    const { rows } = await client.query<DueRow>(
      `SELECT id, title, date, time, repeat, interval_hours, next_at FROM reminders
       WHERE active AND next_at IS NOT NULL AND next_at <= $1
       FOR UPDATE SKIP LOCKED`,
      [now],
    );
    for (const r of rows) {
      const rule = { date: r.date, time: r.time, repeat: r.repeat, intervalHours: r.interval_hours };
      const next = nextOccurrence(rule, now);
      await client.query(
        `UPDATE reminders SET last_sent_at = $2, next_at = $3, active = CASE WHEN $3::timestamptz IS NULL THEN false ELSE active END
         WHERE id = $1`,
        [r.id, now, next],
      );
      // Lembretes muito atrasados (ex.: servidor parado por horas) não disparam em massa: só se < 1h.
      if (now.getTime() - r.next_at.getTime() < 60 * 60 * 1000) {
        count += 1;
        void sendToAll(db, { title: r.title, body: `Lembrete · ${r.time}`, url: '/lembretes', tag: `reminder-${r.id}` }, log);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return count;
}

export function startReminderCron(db: Db, log: FastifyBaseLogger) {
  return cron.schedule('* * * * *', () => {
    dispatchDueReminders(db, log).catch((err) => log.error({ err }, 'erro no agendador de lembretes'));
    dispatchDueEventNotifications(db, log).catch((err) => log.error({ err }, 'erro nas notificações da agenda'));
  });
}
