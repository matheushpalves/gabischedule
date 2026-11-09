import { z } from 'zod';

/* ---------- Primitivos ---------- */

export const COLORS = ['rosa', 'lilas', 'verde', 'pessego', 'azul'] as const;
export const colorSchema = z.enum(COLORS);
export type ColorName = z.infer<typeof colorSchema>;

/** Data local (America/Sao_Paulo) no formato YYYY-MM-DD. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Data inválida');
/** Hora local no formato HH:MM. */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida');
/** Mês no formato YYYY-MM. */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido');

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

const title = z.string().trim().min(1, 'Informe um título').max(200);
const shortName = z.string().trim().min(1, 'Informe um nome').max(40);

/* ---------- Autenticação ---------- */

export const loginSchema = z.object({ code: z.string().regex(/^\d{1,10}$/) });
export type LoginInput = z.infer<typeof loginSchema>;

/* ---------- Tarefas ---------- */

export const taskCategoryInputSchema = z.object({ name: shortName, color: colorSchema });
export type TaskCategoryInput = z.infer<typeof taskCategoryInputSchema>;
export interface TaskCategory extends TaskCategoryInput {
  id: number;
}

export const taskInputSchema = z.object({
  title,
  notes: z.string().trim().max(2000).nullable().default(null),
  categoryId: z.number().int().positive().nullable().default(null),
  dueDate: dateSchema.nullable().default(null),
  dueTime: timeSchema.nullable().default(null),
});
export type TaskInput = z.input<typeof taskInputSchema>;
export const taskPatchSchema = z
  .object({
    title,
    notes: z.string().trim().max(2000).nullable(),
    categoryId: z.number().int().positive().nullable(),
    dueDate: dateSchema.nullable(),
    dueTime: timeSchema.nullable(),
    done: z.boolean(),
  })
  .partial();
export type TaskPatch = z.infer<typeof taskPatchSchema>;
export interface Task {
  id: number;
  title: string;
  notes: string | null;
  categoryId: number | null;
  dueDate: string | null;
  dueTime: string | null;
  done: boolean;
  doneDate: string | null;
  createdAt: string;
}

/* ---------- Agenda ---------- */

const eventBase = z.object({
  title,
  place: z.string().trim().max(120).default(''),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  color: colorSchema.default('rosa'),
});
const endAfterStart = (e: { startTime?: string; endTime?: string }) =>
  !e.startTime || !e.endTime || e.endTime > e.startTime;
export const eventInputSchema = eventBase.refine(endAfterStart, {
  message: 'O fim deve ser depois do início',
  path: ['endTime'],
});
export type EventInput = z.input<typeof eventInputSchema>;
export const eventPatchSchema = eventBase.partial().refine(endAfterStart, {
  message: 'O fim deve ser depois do início',
  path: ['endTime'],
});
export interface CalendarEvent {
  id: number;
  title: string;
  place: string;
  date: string;
  startTime: string;
  endTime: string;
  color: ColorName;
}

/* ---------- Lembretes ---------- */

export const REPEATS = ['once', 'daily', 'weekly', 'monthly', 'yearly', 'hourly'] as const;
export const repeatSchema = z.enum(REPEATS);
export type Repeat = z.infer<typeof repeatSchema>;

const reminderBase = z.object({
  title,
  date: dateSchema,
  time: timeSchema,
  repeat: repeatSchema,
  intervalHours: z.number().int().min(1).max(168).nullable().default(null),
  active: z.boolean().default(true),
});
export const reminderInputSchema = reminderBase.refine(
  (r) => r.repeat !== 'hourly' || r.intervalHours != null,
  { message: 'Informe o intervalo em horas', path: ['intervalHours'] },
);
export type ReminderInput = z.input<typeof reminderInputSchema>;
export const reminderPatchSchema = reminderBase.partial();
export interface Reminder {
  id: number;
  title: string;
  date: string;
  time: string;
  repeat: Repeat;
  intervalHours: number | null;
  active: boolean;
  /** Próximo disparo (ISO, UTC) ou null se não há mais disparos. */
  nextAt: string | null;
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/* ---------- Kanban ---------- */

export const KANBAN_COLUMNS = ['A fazer', 'Fazendo', 'Feito'] as const;
export const columnSchema = z.number().int().min(0).max(2);

export const boardInputSchema = z.object({ name: shortName });
export interface Board {
  id: number;
  name: string;
}

export const cardInputSchema = z.object({
  boardId: z.number().int().positive(),
  title,
  tag: z.string().trim().max(30).default(''),
  color: colorSchema.default('rosa'),
  dueDate: dateSchema.nullable().default(null),
  column: columnSchema.default(0),
});
export type CardInput = z.input<typeof cardInputSchema>;
export const cardPatchSchema = cardInputSchema.omit({ boardId: true, column: true }).partial();
export const cardMoveSchema = z.object({ column: columnSchema, index: z.number().int().min(0) });
export type CardMove = z.infer<typeof cardMoveSchema>;
export interface Card {
  id: number;
  boardId: number;
  column: number;
  position: number;
  title: string;
  tag: string;
  color: ColorName;
  dueDate: string | null;
}

/* ---------- Finanças ---------- */

const cents = z.number().int().min(0).max(1_000_000_000);

export const finCategoryInputSchema = z.object({
  name: shortName,
  color: colorSchema,
  limitCents: cents.nullable().default(null),
});
export type FinCategoryInput = z.input<typeof finCategoryInputSchema>;
export interface FinCategory {
  id: number;
  name: string;
  color: ColorName;
  limitCents: number | null;
}

export const TX_TYPES = ['in', 'out'] as const;
export const transactionInputSchema = z.object({
  title,
  type: z.enum(TX_TYPES),
  amountCents: cents.refine((v) => v > 0, 'O valor deve ser maior que zero'),
  categoryId: z.number().int().positive().nullable().default(null),
  date: dateSchema,
});
export type TransactionInput = z.input<typeof transactionInputSchema>;
export const transactionPatchSchema = transactionInputSchema.partial();
export interface Transaction {
  id: number;
  title: string;
  type: 'in' | 'out';
  amountCents: number;
  categoryId: number | null;
  date: string;
}

export const goalInputSchema = z.object({ name: shortName, savedCents: cents, targetCents: cents.refine((v) => v > 0) });
export type GoalInput = z.infer<typeof goalInputSchema>;
export interface Goal extends GoalInput {
  id: number;
}

export interface BudgetLine {
  categoryId: number;
  name: string;
  color: ColorName;
  limitCents: number;
  spentCents: number;
}
export interface FinanceSummary {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  budgets: BudgetLine[];
}
