import { DateTime } from 'luxon';
import type { FastifyBaseLogger } from 'fastify';
import { leadShort, type EventRepeat } from '@gabi/shared';
import type { Db } from '../db';
import { todayInSaoPaulo } from '../lib/time';
import { nextOccurrence } from '../reminders/schedule';
import { sendToAll } from '../reminders/push';

export interface EventSeries {
  date: string; // início da série (YYYY-MM-DD, São Paulo)
  startTime: string;
  repeat: EventRepeat;
  repeatUntil: string | null;
  notifyMinutes: number[];
}

const UNIT = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' } as const;
/** Maior duração possível de cada unidade, em dias: a estimativa inicial nunca passa da ocorrência certa. */
const MAX_DAYS = { daily: 1, weekly: 7, monthly: 31, yearly: 366 } as const;

/**
 * Datas das ocorrências da série entre `from` e `to` (inclusive).
 * Meses/anos contam a partir da data inicial: dia 31 vira o último dia de meses curtos.
 */
export function occurrenceDates(s: Pick<EventSeries, 'date' | 'repeat' | 'repeatUntil'>, from: string, to: string): string[] {
  const last = s.repeatUntil && s.repeatUntil < to ? s.repeatUntil : to;
  if (s.repeat === 'once') return s.date >= from && s.date <= last ? [s.date] : [];
  const start = DateTime.fromISO(s.date, { zone: 'utc' });
  const diffDays = DateTime.fromISO(from, { zone: 'utc' }).diff(start, 'days').days;
  let n = Math.max(0, Math.floor(diffDays / MAX_DAYS[s.repeat]) - 1);
  const out: string[] = [];
  for (let guard = 0; guard < 5000; guard++, n++) {
    const d = start.plus({ [UNIT[s.repeat]]: n }).toISODate()!;
    if (d > last) break;
    if (d >= from) out.push(d);
  }
  return out;
}

/** Próximo envio de UMA antecedência (em minutos), estritamente depois de `after`. */
function nextForLead(s: EventSeries, minutes: number, after: Date): Date | null {
  const lead = minutes * 60_000;
  const start = nextOccurrence(
    { date: s.date, time: s.startTime, repeat: s.repeat, intervalHours: null },
    new Date(after.getTime() + lead),
  );
  if (!start) return null;
  if (s.repeatUntil && todayInSaoPaulo(start) > s.repeatUntil) return null;
  return new Date(start.getTime() - lead);
}

/** Próximo envio considerando todas as notificações do compromisso (ou null se não há). */
export function nextNotifyAt(s: EventSeries, after: Date): Date | null {
  let best: Date | null = null;
  for (const m of s.notifyMinutes) {
    const t = nextForLead(s, m, after);
    if (t && (!best || t < best)) best = t;
  }
  return best;
}

/** Quais antecedências correspondem ao envio marcado para `at` (normalmente uma). */
export function leadsDueAt(s: EventSeries, at: Date): number[] {
  const justBefore = new Date(at.getTime() - 1);
  return s.notifyMinutes.filter((m) => nextForLead(s, m, justBefore)?.getTime() === at.getTime());
}

interface DueRow {
  id: number;
  title: string;
  place: string;
  date: string;
  start_time: string;
  end_time: string;
  repeat: EventRepeat;
  repeat_until: string | null;
  notify_minutes: number[];
  notify_next_at: Date;
}

/** Envia as notificações de compromissos vencidas e agenda a próxima ocorrência. */
export async function dispatchDueEventNotifications(db: Db, log: FastifyBaseLogger, now = new Date()): Promise<number> {
  const client = await db.connect();
  let count = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<DueRow>(
      `SELECT id, title, place, date, start_time, end_time, repeat, repeat_until, notify_minutes, notify_next_at
       FROM events WHERE notify_next_at IS NOT NULL AND notify_next_at <= $1 AND cardinality(notify_minutes) > 0
       FOR UPDATE SKIP LOCKED`,
      [now],
    );
    for (const e of rows) {
      const series: EventSeries = {
        date: e.date,
        startTime: e.start_time,
        repeat: e.repeat,
        repeatUntil: e.repeat_until,
        notifyMinutes: e.notify_minutes,
      };
      await client.query('UPDATE events SET notify_next_at = $2 WHERE id = $1', [e.id, nextNotifyAt(series, e.notify_next_at)]);
      // Não dispara avisos muito atrasados (ex.: servidor ficou parado).
      if (now.getTime() - e.notify_next_at.getTime() < 60 * 60 * 1000) {
        const due = leadsDueAt(series, e.notify_next_at);
        // Se duas antecedências caem no mesmo instante, manda só a mais próxima do início.
        const lead = due.length ? Math.min(...due) : Math.min(...e.notify_minutes);
        count += 1;
        const when = lead === 0 ? 'Começa agora' : lead === 1440 ? 'É amanhã' : `Começa em ${leadShort(lead)}`;
        void sendToAll(
          db,
          {
            title: e.title,
            body: `${when} · ${e.start_time}–${e.end_time}${e.place ? ` · ${e.place}` : ''}`,
            url: '/agenda',
            tag: `event-${e.id}-${lead}`,
          },
          log,
        );
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
