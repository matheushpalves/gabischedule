import { DateTime } from 'luxon';
import { TIME_ZONE, type Repeat } from '@gabi/shared';

export interface ReminderRule {
  date: string; // YYYY-MM-DD (São Paulo)
  time: string; // HH:MM
  repeat: Repeat;
  intervalHours: number | null;
}

function start(rule: ReminderRule): DateTime {
  return DateTime.fromISO(`${rule.date}T${rule.time}`, { zone: TIME_ZONE });
}

/** n-ésima ocorrência (n = 0 é a data/hora inicial). Meses/anos são contados a partir da data inicial, então dia 31 vira o último dia de meses curtos. */
function occurrence(rule: ReminderRule, n: number): DateTime {
  const s = start(rule);
  switch (rule.repeat) {
    case 'once':
      return s;
    case 'daily':
      return s.plus({ days: n });
    case 'weekly':
      return s.plus({ weeks: n });
    case 'monthly':
      return s.plus({ months: n });
    case 'yearly':
      return s.plus({ years: n });
    case 'hourly':
      return s.plus({ hours: n * (rule.intervalHours ?? 1) });
  }
}

/**
 * Primeira ocorrência estritamente posterior a `after` (ou igual, se `inclusive`).
 * Retorna null quando não há mais ocorrências (lembrete "uma vez" que já passou).
 */
export function nextOccurrence(rule: ReminderRule, after: Date, inclusive = false): Date | null {
  const s = start(rule);
  if (!s.isValid) return null;
  const t = after.getTime();
  const passes = (d: DateTime) => (inclusive ? d.toMillis() >= t : d.toMillis() > t);
  if (passes(s)) return s.toJSDate();
  if (rule.repeat === 'once') return null;

  // Estimativa do índice para evitar laços longos, depois ajuste fino.
  const diffMs = t - s.toMillis();
  const approxMs: Record<Exclude<Repeat, 'once'>, number> = {
    daily: 86_400_000,
    weekly: 7 * 86_400_000,
    monthly: 28 * 86_400_000,
    yearly: 365 * 86_400_000,
    hourly: (rule.intervalHours ?? 1) * 3_600_000,
  };
  let n = Math.max(0, Math.floor(diffMs / approxMs[rule.repeat]) - 2);
  // Recuo de segurança (meses têm 28–31 dias, horário de verão etc.).
  while (n > 0 && passes(occurrence(rule, n))) n -= 1;
  while (!passes(occurrence(rule, n))) n += 1;
  return occurrence(rule, n).toJSDate();
}
