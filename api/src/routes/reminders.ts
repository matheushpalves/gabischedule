import type { FastifyInstance } from 'fastify';
import {
  pushSubscriptionSchema,
  reminderInputSchema,
  reminderPatchSchema,
  type Reminder,
  type ReminderCompletion,
} from '@gabi/shared';
import type { Config } from '../config';
import type { Db } from '../db';
import { HttpError, idOf, notFound, parse } from '../lib/http';
import { pushEnabled, sendToAll } from '../reminders/push';
import { nextOccurrence } from '../reminders/schedule';
import { currentOccurrence } from '../reminders/current';

const COLS = `id, title, date, time, repeat, interval_hours AS "intervalHours", active, next_at AS "nextAt"`;

type Row = Omit<Reminder, 'nextAt' | 'currentAt'> & { nextAt: Date | null };

/** Instantes (ms) já concluídos, por lembrete. Basta olhar de ontem em diante, e tudo dos "uma vez". */
async function completedMap(db: Db, now: Date, ids?: number[]): Promise<Map<number, Set<number>>> {
  const { rows } = await db.query<{ reminder_id: number; occurrence_at: Date }>(
    `SELECT c.reminder_id, c.occurrence_at FROM reminder_completions c JOIN reminders r ON r.id = c.reminder_id
     WHERE (c.occurrence_at >= $1 OR r.repeat = 'once') AND ($2::int[] IS NULL OR c.reminder_id = ANY($2))`,
    [new Date(now.getTime() - 2 * 86_400_000), ids ?? null],
  );
  const map = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!map.has(r.reminder_id)) map.set(r.reminder_id, new Set());
    map.get(r.reminder_id)!.add(r.occurrence_at.getTime());
  }
  return map;
}

function present(r: Row, completed: Set<number> | undefined, now: Date): Reminder {
  const current = currentOccurrence(r, completed ?? new Set(), now);
  return { ...r, nextAt: r.nextAt?.toISOString() ?? null, currentAt: current?.toISOString() ?? null };
}

async function presentOne(db: Db, r: Row): Promise<Reminder> {
  const now = new Date();
  return present(r, (await completedMap(db, now, [r.id])).get(r.id), now);
}

export async function reminderRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  app.get('/api/reminders', async () => {
    const now = new Date();
    const { rows } = await db.query<Row>(`SELECT ${COLS} FROM reminders ORDER BY next_at NULLS LAST, id`);
    const done = await completedMap(db, now);
    return rows.map((r) => present(r, done.get(r.id), now));
  });

  /** "Feito": conclui a ocorrência da vez. Se for a próxima a disparar, a notificação dela não é enviada. */
  app.post('/api/reminders/:id/done', async (req, reply) => {
    const id = idOf(req.params);
    const now = new Date();
    const { rows: cur } = await db.query<Row>(`SELECT ${COLS} FROM reminders WHERE id = $1`, [id]);
    const r = cur[0] ?? notFound();
    const at = currentOccurrence(r, (await completedMap(db, now, [id])).get(id) ?? new Set(), now);
    if (!at) throw new HttpError(400, 'Esse lembrete já foi concluído');
    await db.query(
      'INSERT INTO reminder_completions (reminder_id, occurrence_at, done_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [id, at, now],
    );
    if (r.repeat === 'once') {
      await db.query('UPDATE reminders SET active = false, next_at = NULL WHERE id = $1', [id]);
    } else if (r.nextAt && r.nextAt.getTime() === at.getTime()) {
      await db.query('UPDATE reminders SET next_at = $2 WHERE id = $1', [id, nextOccurrence(r, at)]);
    }
    const { rows } = await db.query<Row>(`SELECT ${COLS} FROM reminders WHERE id = $1`, [id]);
    return reply.code(201).send(await presentOne(db, rows[0]!));
  });

  /** Concluídos recentes (últimos 30 dias). */
  app.get('/api/reminder-completions', async () => {
    const { rows } = await db.query<ReminderCompletion>(
      `SELECT c.id, c.reminder_id AS "reminderId", r.title, r.repeat, r.interval_hours AS "intervalHours",
              c.occurrence_at AS "occurrenceAt", c.done_at AS "doneAt"
       FROM reminder_completions c JOIN reminders r ON r.id = c.reminder_id
       WHERE c.done_at > now() - interval '30 days'
       ORDER BY c.done_at DESC LIMIT 100`,
    );
    return rows;
  });

  /** Desfaz um "Feito". */
  app.delete('/api/reminder-completions/:id', async (req, reply) => {
    const { rows } = await db.query<{ reminder_id: number; occurrence_at: Date }>(
      'DELETE FROM reminder_completions WHERE id = $1 RETURNING reminder_id, occurrence_at',
      [idOf(req.params)],
    );
    const c = rows[0] ?? notFound();
    const { rows: cur } = await db.query<Row>(`SELECT ${COLS} FROM reminders WHERE id = $1`, [c.reminder_id]);
    const r = cur[0];
    if (r) {
      const now = new Date();
      if (r.repeat === 'once') {
        const next = nextOccurrence(r, now, true);
        await db.query('UPDATE reminders SET active = $2, next_at = $3 WHERE id = $1', [r.id, next !== null, next]);
      } else if (c.occurrence_at > now && (!r.nextAt || c.occurrence_at < r.nextAt)) {
        // Foi concluído antes da hora: volta a notificar nessa ocorrência.
        await db.query('UPDATE reminders SET next_at = $2 WHERE id = $1', [r.id, c.occurrence_at]);
      }
    }
    return reply.code(204).send();
  });

  app.post('/api/reminders', async (req, reply) => {
    const r = parse(reminderInputSchema, req.body);
    const intervalHours = r.repeat === 'hourly' ? r.intervalHours : null;
    const next = nextOccurrence({ ...r, intervalHours }, new Date(), true);
    const { rows } = await db.query<Row>(
      `INSERT INTO reminders (title, date, time, repeat, interval_hours, active, next_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLS}`,
      [r.title, r.date, r.time, r.repeat, intervalHours, r.active && next !== null, next],
    );
    return reply.code(201).send(await presentOne(db, rows[0]!));
  });

  app.patch('/api/reminders/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(reminderPatchSchema, req.body);
    const { rows: cur } = await db.query<Row>(`SELECT ${COLS} FROM reminders WHERE id = $1`, [id]);
    const current = cur[0] ?? notFound();
    const m = { ...current, ...p };
    if (m.repeat === 'hourly' && m.intervalHours == null) throw new HttpError(400, 'Informe o intervalo em horas');
    const intervalHours = m.repeat === 'hourly' ? m.intervalHours : null;
    // Sempre recalcula o próximo disparo a partir de agora.
    const next = nextOccurrence({ ...m, intervalHours }, new Date(), true);
    if (p.active && next === null) throw new HttpError(400, 'Esse lembrete já passou. Escolha uma nova data.');
    const { rows } = await db.query<Row>(
      `UPDATE reminders SET title=$2, date=$3, time=$4, repeat=$5, interval_hours=$6, active=$7, next_at=$8
       WHERE id = $1 RETURNING ${COLS}`,
      [id, m.title, m.date, m.time, m.repeat, intervalHours, m.active && next !== null, next],
    );
    return presentOne(db, rows[0]!);
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
