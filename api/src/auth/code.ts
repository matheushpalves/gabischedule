import { createHash, timingSafeEqual } from 'node:crypto';
import { TIME_ZONE } from '@gabi/shared';

/** Tolerância na virada do dia: o código de ontem continua valendo por 5 minutos após a meia-noite. */
export const MIDNIGHT_GRACE_MS = 5 * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, day: 'numeric' });

/** Dia do mês (1–31) no fuso de São Paulo. */
export function dayOfMonthInSaoPaulo(at: Date): number {
  return Number(dayFormatter.format(at));
}

/** Códigos aceitos no instante `now`: o de hoje e, nos primeiros 5 minutos do dia, o de ontem. */
export function acceptedCodes(base: number, now: Date): string[] {
  const today = dayOfMonthInSaoPaulo(now);
  const graceDay = dayOfMonthInSaoPaulo(new Date(now.getTime() - MIDNIGHT_GRACE_MS));
  const codes = [String(base + today)];
  if (graceDay !== today) codes.push(String(base + graceDay));
  return codes;
}

function digest(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}

/**
 * Verifica o código em tempo constante: compara digests de tamanho fixo
 * com timingSafeEqual e sempre testa todos os candidatos (sem retorno antecipado).
 */
export function isValidCode(input: string, base: number, now: Date = new Date()): boolean {
  const given = digest(input);
  let ok = false;
  for (const code of acceptedCodes(base, now)) {
    ok = timingSafeEqual(given, digest(code)) || ok;
  }
  return ok;
}
