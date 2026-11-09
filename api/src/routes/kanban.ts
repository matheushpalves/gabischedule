import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { boardInputSchema, cardInputSchema, cardMoveSchema, cardPatchSchema, type Board, type Card } from '@gabi/shared';
import type { Db } from '../db';
import { buildUpdate, idOf, notFound, parse } from '../lib/http';

const CARD_COLS = `id, board_id AS "boardId", col AS "column", position, title, tag, color, due_date AS "dueDate"`;

export async function kanbanRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /* Quadros */
  app.get('/api/boards', async () => (await db.query<Board>('SELECT id, name FROM boards ORDER BY id')).rows);
  app.post('/api/boards', async (req, reply) => {
    const b = parse(boardInputSchema, req.body);
    const { rows } = await db.query<Board>('INSERT INTO boards (name) VALUES ($1) RETURNING id, name', [b.name]);
    return reply.code(201).send(rows[0]);
  });
  app.put('/api/boards/:id', async (req) => {
    const b = parse(boardInputSchema, req.body);
    const { rows } = await db.query<Board>('UPDATE boards SET name = $2 WHERE id = $1 RETURNING id, name', [idOf(req.params), b.name]);
    return rows[0] ?? notFound();
  });
  app.delete('/api/boards/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM boards WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });

  /* Cartões */
  app.get('/api/cards', async (req) => {
    const q = parse(z.object({ boardId: z.coerce.number().int().positive() }), req.query);
    const { rows } = await db.query<Card>(`SELECT ${CARD_COLS} FROM cards WHERE board_id = $1 ORDER BY col, position, id`, [q.boardId]);
    return rows;
  });
  app.post('/api/cards', async (req, reply) => {
    const c = parse(cardInputSchema, req.body);
    const { rows } = await db.query<Card>(
      `INSERT INTO cards (board_id, col, position, title, tag, color, due_date)
       VALUES ($1, $2, (SELECT COALESCE(MAX(position) + 1, 0) FROM cards WHERE board_id = $1 AND col = $2), $3, $4, $5, $6)
       RETURNING ${CARD_COLS}`,
      [c.boardId, c.column, c.title, c.tag, c.color, c.dueDate],
    );
    return reply.code(201).send(rows[0]);
  });
  app.patch('/api/cards/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(cardPatchSchema, req.body);
    const { set, values } = buildUpdate(p, { title: 'title', tag: 'tag', color: 'color', dueDate: 'due_date' });
    const sql = set
      ? `UPDATE cards SET ${set} WHERE id = $1 RETURNING ${CARD_COLS}`
      : `SELECT ${CARD_COLS} FROM cards WHERE id = $1`;
    const { rows } = await db.query<Card>(sql, set ? [id, ...values] : [id]);
    return rows[0] ?? notFound();
  });

  /** Move o cartão para (coluna, índice) e renumera as posições das colunas afetadas. */
  app.post('/api/cards/:id/move', async (req) => {
    const id = idOf(req.params);
    const m = parse(cardMoveSchema, req.body);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows: cur } = await client.query<{ board_id: number; col: number }>(
        'SELECT board_id, col FROM cards WHERE id = $1 FOR UPDATE',
        [id],
      );
      const card = cur[0] ?? notFound();
      const { rows: target } = await client.query<{ id: number }>(
        'SELECT id FROM cards WHERE board_id = $1 AND col = $2 AND id <> $3 ORDER BY position, id FOR UPDATE',
        [card.board_id, m.column, id],
      );
      const ids = target.map((r) => r.id);
      ids.splice(Math.min(m.index, ids.length), 0, id);
      await client.query(
        `UPDATE cards SET col = $2, position = t.ord - 1
         FROM unnest($1::int[]) WITH ORDINALITY AS t(cid, ord) WHERE cards.id = t.cid`,
        [ids, m.column],
      );
      if (card.col !== m.column) {
        await client.query(
          `UPDATE cards SET position = t.rn - 1 FROM (
             SELECT id, row_number() OVER (ORDER BY position, id) AS rn FROM cards WHERE board_id = $1 AND col = $2
           ) t WHERE cards.id = t.id`,
          [card.board_id, card.col],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const { rows } = await db.query<Card>(`SELECT ${CARD_COLS} FROM cards WHERE id = $1`, [id]);
    return rows[0];
  });

  app.delete('/api/cards/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM cards WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });
}
