import { TIME_ZONE } from '@gabi/shared';

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Data de hoje (YYYY-MM-DD) em São Paulo. */
export function todayInSaoPaulo(at: Date = new Date()): string {
  return ymd.format(at);
}

/** Primeiro e último dia (YYYY-MM-DD) de um mês YYYY-MM. */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}
