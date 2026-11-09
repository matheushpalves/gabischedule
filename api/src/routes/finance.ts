import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  finCategoryInputSchema,
  goalInputSchema,
  monthSchema,
  transactionInputSchema,
  transactionPatchSchema,
  type BudgetLine,
  type FinCategory,
  type FinanceSummary,
  type Goal,
  type Transaction,
} from '@gabi/shared';
import type { Db } from '../db';
import { buildUpdate, idOf, notFound, parse } from '../lib/http';
import { monthRange } from '../lib/time';

const CAT_COLS = `id, name, color, limit_cents AS "limitCents"`;
const TX_COLS = `id, title, type, amount_cents AS "amountCents", category_id AS "categoryId", date`;
const GOAL_COLS = `id, name, saved_cents AS "savedCents", target_cents AS "targetCents"`;
const monthQuery = z.object({ month: monthSchema });

export async function financeRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /* Categorias / orçamento */
  app.get('/api/finance/categories', async () => (await db.query<FinCategory>(`SELECT ${CAT_COLS} FROM fin_categories ORDER BY id`)).rows);
  app.post('/api/finance/categories', async (req, reply) => {
    const c = parse(finCategoryInputSchema, req.body);
    const { rows } = await db.query<FinCategory>(
      `INSERT INTO fin_categories (name, color, limit_cents) VALUES ($1,$2,$3) RETURNING ${CAT_COLS}`,
      [c.name, c.color, c.limitCents],
    );
    return reply.code(201).send(rows[0]);
  });
  app.put('/api/finance/categories/:id', async (req) => {
    const c = parse(finCategoryInputSchema, req.body);
    const { rows } = await db.query<FinCategory>(
      `UPDATE fin_categories SET name=$2, color=$3, limit_cents=$4 WHERE id=$1 RETURNING ${CAT_COLS}`,
      [idOf(req.params), c.name, c.color, c.limitCents],
    );
    return rows[0] ?? notFound();
  });
  app.delete('/api/finance/categories/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM fin_categories WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });

  /* Movimentações */
  app.get('/api/finance/transactions', async (req) => {
    const [from, to] = monthRange(parse(monthQuery, req.query).month);
    const { rows } = await db.query<Transaction>(
      `SELECT ${TX_COLS} FROM transactions WHERE date BETWEEN $1 AND $2 ORDER BY date DESC, id DESC`,
      [from, to],
    );
    return rows;
  });
  app.post('/api/finance/transactions', async (req, reply) => {
    const t = parse(transactionInputSchema, req.body);
    const { rows } = await db.query<Transaction>(
      `INSERT INTO transactions (title, type, amount_cents, category_id, date) VALUES ($1,$2,$3,$4,$5) RETURNING ${TX_COLS}`,
      [t.title, t.type, t.amountCents, t.categoryId, t.date],
    );
    return reply.code(201).send(rows[0]);
  });
  app.patch('/api/finance/transactions/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(transactionPatchSchema, req.body);
    const { set, values } = buildUpdate(p, {
      title: 'title', type: 'type', amountCents: 'amount_cents', categoryId: 'category_id', date: 'date',
    });
    const sql = set ? `UPDATE transactions SET ${set} WHERE id = $1 RETURNING ${TX_COLS}` : `SELECT ${TX_COLS} FROM transactions WHERE id = $1`;
    const { rows } = await db.query<Transaction>(sql, set ? [id, ...values] : [id]);
    return rows[0] ?? notFound();
  });
  app.delete('/api/finance/transactions/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM transactions WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });

  /* Resumo do mês */
  app.get('/api/finance/summary', async (req): Promise<FinanceSummary> => {
    const { month } = parse(monthQuery, req.query);
    const [from, to] = monthRange(month);
    const { rows: totals } = await db.query<{ income: number; expense: number }>(
      `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE type = 'in'), 0)::bigint AS income,
              COALESCE(SUM(amount_cents) FILTER (WHERE type = 'out'), 0)::bigint AS expense
       FROM transactions WHERE date BETWEEN $1 AND $2`,
      [from, to],
    );
    const { rows: budgets } = await db.query<BudgetLine>(
      `SELECT c.id AS "categoryId", c.name, c.color, c.limit_cents AS "limitCents",
              COALESCE(SUM(t.amount_cents), 0)::bigint AS "spentCents"
       FROM fin_categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.type = 'out' AND t.date BETWEEN $1 AND $2
       WHERE c.limit_cents IS NOT NULL AND c.limit_cents > 0
       GROUP BY c.id ORDER BY c.id`,
      [from, to],
    );
    const { income, expense } = totals[0] ?? { income: 0, expense: 0 };
    return { month, incomeCents: income, expenseCents: expense, balanceCents: income - expense, budgets };
  });

  /* Metas */
  app.get('/api/finance/goals', async () => (await db.query<Goal>(`SELECT ${GOAL_COLS} FROM goals ORDER BY id`)).rows);
  app.post('/api/finance/goals', async (req, reply) => {
    const g = parse(goalInputSchema, req.body);
    const { rows } = await db.query<Goal>(
      `INSERT INTO goals (name, saved_cents, target_cents) VALUES ($1,$2,$3) RETURNING ${GOAL_COLS}`,
      [g.name, g.savedCents, g.targetCents],
    );
    return reply.code(201).send(rows[0]);
  });
  app.put('/api/finance/goals/:id', async (req) => {
    const g = parse(goalInputSchema, req.body);
    const { rows } = await db.query<Goal>(
      `UPDATE goals SET name=$2, saved_cents=$3, target_cents=$4 WHERE id=$1 RETURNING ${GOAL_COLS}`,
      [idOf(req.params), g.name, g.savedCents, g.targetCents],
    );
    return rows[0] ?? notFound();
  });
  app.delete('/api/finance/goals/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM goals WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });
}
