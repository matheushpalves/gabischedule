import { DateTime } from 'luxon';
import { TIME_ZONE } from '@gabi/shared';
import { nextOccurrence, type ReminderRule } from './schedule';

export interface ReminderState extends ReminderRule {
  active: boolean;
  nextAt: Date | null;
}

/**
 * Ocorrência "da vez" de um lembrete, que é a que o botão "Feito" conclui:
 * - "uma vez": a própria data/hora, até ser concluída;
 * - repetidos ativos: a ocorrência mais recente de HOJE que já passou e não foi concluída;
 *   se não houver, a próxima (`nextAt`);
 * - repetidos pausados: o próximo horário a partir de agora (nunca "atrasado").
 * `completed` são os instantes (ms) de ocorrências já concluídas.
 */
export function currentOccurrence(r: ReminderState, completed: Set<number>, now: Date): Date | null {
  if (r.repeat === 'once') {
    const at = DateTime.fromISO(`${r.date}T${r.time}`, { zone: TIME_ZONE }).toJSDate();
    return completed.has(at.getTime()) ? null : at;
  }
  if (!r.active) return nextOccurrence(r, now, true);

  const startOfToday = DateTime.fromJSDate(now).setZone(TIME_ZONE).startOf('day').toJSDate();
  let latest: Date | null = null;
  let o = nextOccurrence(r, startOfToday, true);
  for (let guard = 0; o && o <= now && guard < 200; guard++) {
    latest = o;
    o = nextOccurrence(r, o);
  }
  if (latest && !completed.has(latest.getTime())) return latest;

  // Pula ocorrências futuras já concluídas antecipadamente.
  let next = r.nextAt;
  for (let guard = 0; next && completed.has(next.getTime()) && guard < 200; guard++) next = nextOccurrence(r, next);
  return next;
}
