import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dateSchema, eventInputSchema, eventPatchSchema, type CalendarEvent } from '@gabi/shared';
import type { Db } from '../db';
import { HttpError, buildUpdate, idOf, notFound, parse } from '../lib/http';

const COLS = `id, title, place, date, start_time AS "startTime", end_time AS "endTime", color`;

export async function eventRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/api/events', async (req) => {
    const q = parse(z.object({ from: dateSchema, to: dateSchema }), req.query);
    // Inclui o dia anterior a `from`: compromissos que atravessam a meia-noite continuam no primeiro dia do intervalo.
    const { rows } = await db.query<CalendarEvent>(
      `SELECT ${COLS} FROM events
       WHERE date BETWEEN $1 AND $2 OR (date = $1::date - 1 AND end_time < start_time)
       ORDER BY date, start_time, id`,
      [q.from, q.to],
    );
    return rows;
  });
  app.post('/api/events', async (req, reply) => {
    const e = parse(eventInputSchema, req.body);
    const { rows } = await db.query<CalendarEvent>(
      `INSERT INTO events (title, place, date, start_time, end_time, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
      [e.title, e.place, e.date, e.startTime, e.endTime, e.color],
    );
    return reply.code(201).send(rows[0]);
  });
  app.patch('/api/events/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(eventPatchSchema, req.body);
    const { rows: cur } = await db.query<CalendarEvent>(`SELECT ${COLS} FROM events WHERE id = $1`, [id]);
    const current = cur[0] ?? notFound();
    const merged = { ...current, ...p };
    if (merged.endTime === merged.startTime) throw new HttpError(400, 'O fim deve ser diferente do início');
    const { set, values } = buildUpdate(p, {
      title: 'title', place: 'place', date: 'date', startTime: 'start_time', endTime: 'end_time', color: 'color',
    });
    if (!set) return current;
    const { rows } = await db.query<CalendarEvent>(`UPDATE events SET ${set} WHERE id = $1 RETURNING ${COLS}`, [id, ...values]);
    return rows[0];
  });
  app.delete('/api/events/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM events WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });
}
