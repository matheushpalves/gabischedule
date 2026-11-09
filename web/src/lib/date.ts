import { TIME_ZONE } from '@gabi/shared';

/*
 * Datas de calendário são strings YYYY-MM-DD no fuso de São Paulo.
 * Para fazer contas, convertemos para Date em UTC à meia-noite (sem efeito de fuso).
 */

const ymdSP = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const hmSP = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function todaySP(at: Date = new Date()): string {
  return ymdSP.format(at);
}
export function dateOfInstantSP(iso: string): string {
  return ymdSP.format(new Date(iso));
}
export function timeOfInstantSP(iso: string): string {
  return hmSP.format(new Date(iso));
}
export function nowTimeSP(): string {
  return hmSP.format(new Date());
}

function toUTC(d: string): Date {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
}
function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}
export function weekday(d: string): number {
  return toUTC(d).getUTCDay();
}
/** Segunda-feira da semana de `d`. */
export function startOfWeek(d: string): string {
  return addDays(d, -((weekday(d) + 6) % 7));
}
export function dayNum(d: string): number {
  return Number(d.slice(8, 10));
}
export function monthOf(d: string): string {
  return d.slice(0, 7);
}
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const x = new Date(Date.UTC(y, m - 1 + n, 1));
  return x.toISOString().slice(0, 7);
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Novembro 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${cap(MONTHS[m - 1]!)} ${y}`;
}
/** "Sábado, 7 de novembro" */
export function longDate(d: string): string {
  return `${WEEKDAYS[weekday(d)]}, ${dayNum(d)} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
}
/** "07 nov" */
export function shortDate(d: string): string {
  return `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]!.slice(0, 3)}`;
}
/** Hoje / Amanhã / Ontem / "07 nov" */
export function relativeDate(d: string, today = todaySP()): string {
  if (d === today) return 'Hoje';
  if (d === addDays(today, 1)) return 'Amanhã';
  if (d === addDays(today, -1)) return 'Ontem';
  return shortDate(d);
}
