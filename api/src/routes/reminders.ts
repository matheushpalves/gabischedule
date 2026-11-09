import type { FastifyInstance } from 'fastify';
import { pushSubscriptionSchema, reminderInputSchema, reminderPatchSchema, type Reminder } from '@gabi/shared';
import type { Config } from '../config';
import type { Db } from '../db';
import { HttpError, idOf, notFound, parse } from '../lib/http';
import { pushEnabled, sendToAll } from '../reminders/push';
import { nextOccurrence } from '../reminders/schedule';

const COLS = `id, title, date, time, repeat, interval_hours AS "intervalHours", active, next_at AS "nextAt"`;

export async function reminderRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  app.get('/api/reminders', async () => {
    const { rows } = await db.query<Reminder>(`SELECT ${COLS} FROM reminders ORDER BY next_at NULLS LAST, id`);
    return rows;
  });

  app.post('/api/reminders', async (req, reply) => {
    const r = parse(reminderInputSchema, req.body);
    const intervalHours = r.repeat === 'hourly' ? r.intervalHours : null;
    const next = nextOccurrence({ ...r, intervalHours }, new Date(), true);
    const { rows } = await db.query<Reminder>(
      `INSERT INTO reminders (title, date, time, repeat, interval_hours, active, next_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLS}`,
      [r.title, r.date, r.time, r.repeat, intervalHours, r.active && next !== null, next],
    );
    return reply.code(201).send(rows[0]);
  });

  app.patch('/api/reminders/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(reminderPatchSchema, req.body);
    const { rows: cur } = await db.query<Reminder>(`SELECT ${COLS} FROM reminders WHERE id = $1`, [id]);
    const current = cur[0] ?? notFound();
    const m = { ...current, ...p };
    if (m.repeat === 'hourly' && m.intervalHours == null) throw new HttpError(400, 'Informe o intervalo em horas');
    const intervalHours = m.repeat === 'hourly' ? m.intervalHours : null;
    // Sempre recalcula o próximo disparo a partir de agora.
    const next = nextOccurrence({ ...m, intervalHours }, new Date(), true);
    if (p.active && next === null) throw new HttpError(400, 'Esse lembrete já passou. Escolha uma nova data.');
    const { rows } = await db.query<Reminder>(
      `UPDATE reminders SET title=$2, date=$3, time=$4, repeat=$5, interval_hours=$6, active=$7, next_at=$8
       WHERE id = $1 RETURNING ${COLS}`,
      [id, m.title, m.date, m.time, m.repeat, intervalHours, m.active && next !== null, next],
    );
    return rows[0];
  });

  app.delete('/api/reminders/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM reminders WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });

  /* Web Push */
  app.get('/api/push/config', async () => ({
    enabled: pushEnabled(config),
    publicKey: config.VAPID_PUBLIC_KEY || null,
  }));

  app.post('/api/push/subscribe', async (req, reply) => {
    const s = parse(pushSubscriptionSchema, req.body);
    await db.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1,$2,$3)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [s.endpoint, s.keys.p256dh, s.keys.auth],
    );
    return reply.code(201).send({ ok: true });
  });

  app.post('/api/push/unsubscribe', async (req) => {
    const s = parse(pushSubscriptionSchema.pick({ endpoint: true }), req.body);
    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [s.endpoint]);
    return { ok: true };
  });

  app.post('/api/push/test', async (req) => {
    if (!pushEnabled(config)) throw new HttpError(503, 'Notificações não configuradas no servidor');
    const sent = await sendToAll(db, { title: 'Gabi', body: 'Notificações ativadas!', url: '/lembretes' }, req.log);
    return { sent };
  });
}
