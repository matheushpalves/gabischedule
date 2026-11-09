export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;
/** Janela de histórico considerada (qualquer coisa mais antiga é irrelevante). */
export const HISTORY_MS = 24 * 60 * 60 * 1000;

export interface Attempt {
  success: boolean;
  at: Date;
}

/**
 * Calcula até quando o IP está bloqueado a partir do histórico de tentativas
 * (em ordem cronológica). Cada sequência de 5 erros seguidos gera um bloqueio de 15 min;
 * um acerto zera a contagem. Tentativas feitas durante o bloqueio não são registradas.
 * Retorna null se não há bloqueio ativo.
 */
export function lockedUntil(attempts: Attempt[], now: Date): Date | null {
  let failures = 0;
  let until: Date | null = null;
  for (const a of attempts) {
    if (a.success) {
      failures = 0;
      continue;
    }
    failures += 1;
    if (failures >= MAX_FAILURES) {
      until = new Date(a.at.getTime() + LOCK_MS);
      failures = 0;
    }
  }
  return until && until.getTime() > now.getTime() ? until : null;
}
