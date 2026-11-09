import type { FastifyInstance } from 'fastify';
import { taskCategoryInputSchema, taskInputSchema, taskPatchSchema, type Task, type TaskCategory } from '@gabi/shared';
import type { Db } from '../db';
import { buildUpdate, idOf, notFound, parse } from '../lib/http';
import { todayInSaoPaulo } from '../lib/time';

const TASK_COLS = `id, title, notes, category_id AS "categoryId", due_date AS "dueDate", due_time AS "dueTime",
  done, done_date AS "doneDate", created_at AS "createdAt"`;

export async function taskRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /* Categorias */
  app.get('/api/task-categories', async () => {
    const { rows } = await db.query<TaskCategory>('SELECT id, name, color FROM task_categories ORDER BY id');
    return rows;
  });
  app.post('/api/task-categories', async (req, reply) => {
    const c = parse(taskCategoryInputSchema, req.body);
    const { rows } = await db.query<TaskCategory>(
      'INSERT INTO task_categories (name, color) VALUES ($1, $2) RETURNING id, name, color',
      [c.name, c.color],
    );
    return reply.code(201).send(rows[0]);
  });
  app.put('/api/task-categories/:id', async (req) => {
    const id = idOf(req.params);
    const c = parse(taskCategoryInputSchema, req.body);
    const { rows } = await db.query<TaskCategory>(
      'UPDATE task_categories SET name = $2, color = $3 WHERE id = $1 RETURNING id, name, color',
      [id, c.name, c.color],
    );
    return rows[0] ?? notFound();
  });
  app.delete('/api/task-categories/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM task_categories WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });

  /* Tarefas */
  app.get('/api/tasks', async () => {
    const { rows } = await db.query<Task>(
      `SELECT ${TASK_COLS} FROM tasks ORDER BY done, due_date NULLS LAST, due_time NULLS LAST, id`,
    );
    return rows;
  });
  app.post('/api/tasks', async (req, reply) => {
    const t = parse(taskInputSchema, req.body);
    const { rows } = await db.query<Task>(
      `INSERT INTO tasks (title, notes, category_id, due_date, due_time) VALUES ($1, $2, $3, $4, $5)
       RETURNING ${TASK_COLS}`,
      [t.title, t.notes, t.categoryId, t.dueDate, t.dueTime],
    );
    return reply.code(201).send(rows[0]);
  });
  app.patch('/api/tasks/:id', async (req) => {
    const id = idOf(req.params);
    const p = parse(taskPatchSchema, req.body);
    const patch: Record<string, unknown> = { ...p };
    if (p.done !== undefined) patch.doneDate = p.done ? todayInSaoPaulo() : null;
    const { set, values } = buildUpdate(patch, {
      title: 'title',
      notes: 'notes',
      categoryId: 'category_id',
      dueDate: 'due_date',
      dueTime: 'due_time',
      done: 'done',
      doneDate: 'done_date',
    });
    if (!set) {
      const { rows } = await db.query<Task>(`SELECT ${TASK_COLS} FROM tasks WHERE id = $1`, [id]);
      return rows[0] ?? notFound();
    }
    const { rows } = await db.query<Task>(`UPDATE tasks SET ${set} WHERE id = $1 RETURNING ${TASK_COLS}`, [id, ...values]);
    return rows[0] ?? notFound();
  });
  app.delete('/api/tasks/:id', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM tasks WHERE id = $1', [idOf(req.params)]);
    if (!rowCount) notFound();
    return reply.code(204).send();
  });
}
