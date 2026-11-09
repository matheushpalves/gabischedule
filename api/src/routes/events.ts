import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dateSchema, endsNextDay, eventInputSchema, eventPatchSchema, type CalendarEvent } from '@gabi/shared';
import type { Db } from '../db';
import { HttpError, idOf, notFound, parse } from '../lib/http';
import { nextNotifyAt, occurrenceDates } from '../events/series';

type SeriesRow = Omit<CalendarEvent, 'seriesDate'>;

const COLS = `id, title, place, date, start_time AS "startTime", end_time AS "endTime", color,
  repeat, repeat_until AS "repeatUntil", notify_minutes AS "notifyMinutes"`;

const asSingle = (e: SeriesRow): CalendarEvent => ({ ...e, seriesDate: e.date });

function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export async function eventRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /**
   * Ocorrências entre `from` e `to`. Séries repetidas vêm "expandidas" (uma entrada por data).
   * Inclui também compromissos da noite anterior a `from` que atravessam a meia-noite.
   */
  app.get('/api/events', async (req) => {
    const q = parse(z.object({ from: dateSchema, to: dateSchema }), req.query);
    const dayBefore = addDays(q.from, -1);
    const { rows } = await db.query<SeriesRow>(
      `SELECT ${COLS} FROM events
       WHERE date <= $2 AND (date >= $1 OR (repeat <> 'once' AND (repeat_until IS NULL OR repeat_until >= $1)))`,
      [dayBefore, q.to],
    );
    const out: CalendarEvent[] = [];
    for (const s of rows) {
      for (const date of occurrenceDates(s, dayBefore, q.to)) {
        if (date === dayBefore && !endsNextDay(s)) continue;
        out.push({ ...s, date, seriesDate: s.date });
      }
    }
    return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime) || a.id - b.id);
  });

  app.post('/api/events', async (req, reply) => {
    const e = parse(eventInputSchema, req.body);
    const repeatUntil = e.repeat === 'once' ? null : e.repeatUntil;
    if (repeatUntil && repeatUntil < e.date) throw new HttpError(400, 'A repetição deve terminar depois do início');
    const notifyAt = nextNotifyAt({ ...e, repeatUntil }, new Date());
    const { rows } = await db.query<SeriesRow>(
      `INSERT INTO events (title, place, date, start_time, end_time, color, repeat, repeat_until, notify_minutes, notify_next_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${COLS}`,
      [e.title, e.place, e.date, e.startTime, e.endTime, e.color, e.repeat, repeatUntil, e.notifyMinutes, notifyAt],
    );
    return reply.code(201).send(asSingle(rows[0]!));
  });

  /** Edita a série inteira (todas as repetições). */
  app.patch('/api/events/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(eventPatchSchema, req.body);
    const { rows: cur } = await db.query<SeriesRow>(`SELECT ${COLS} FROM events WHERE id = $1`, [id]);
    const m = { ...(cur[0] ?? notFound()), ...p };
    if (m.endTime === m.startTime) throw new HttpError(400, 'O fim deve ser diferente do início');
    const repeatUntil = m.repeat === 'once' ? null : m.repeatUntil;
    if (repeatUntil && repeatUntil < m.date) throw new HttpError(400, 'A repetição deve terminar depois do início');
    const notifyAt = nextNotifyAt({ ...m, repeatUntil }, new Date());
    const { rows } = await db.query<SeriesRow>(
      `UPDATE events SET title=$2, place=$3, date=$4, start_time=$5, end_time=$6, color=$7,
         repeat=$8, repeat_until=$9, notify_minutes=$10, notify_next_at=$11
       WHERE id = $1 RETURNING ${COLS}`,
      [id, m.title, m.place, m.date, m.startTime, m.endTime, m.color, m.repeat, repeatUntil, m.notifyMinutes, notifyAt],
    );
    return asSingle(rows[0]!);
  });

  app.delete('/api/events/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM events WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });
}
