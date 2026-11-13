import { describe, expect, it } from 'vitest';
import { currentOccurrence } from '../src/reminders/current';
import { nextOccurrence } from '../src/reminders/schedule';

const sp = (local: string) => new Date(`${local}-03:00`);
const ms = (...d: Date[]) => new Set(d.map((x) => x.getTime()));

describe('ocorrência da vez (botão "Feito")', () => {
  const vitaminas = { date: '2026-11-01', time: '08:00', repeat: 'daily' as const, intervalHours: null, active: true };

  it('repetido: depois que disparou hoje, a de hoje fica pendente até ser concluída', () => {
    const now = sp('2026-11-09T10:00:00');
    const r = { ...vitaminas, nextAt: nextOccurrence(vitaminas, now) };
    expect(r.nextAt).toEqual(sp('2026-11-10T08:00:00'));
    expect(currentOccurrence(r, new Set(), now)).toEqual(sp('2026-11-09T08:00:00'));
    // concluída → passa para amanhã
    expect(currentOccurrence(r, ms(sp('2026-11-09T08:00:00')), now)).toEqual(sp('2026-11-10T08:00:00'));
  });

  it('repetido: antes da hora, é a próxima (de hoje)', () => {
    const now = sp('2026-11-09T07:00:00');
    const r = { ...vitaminas, nextAt: sp('2026-11-09T08:00:00') };
    expect(currentOccurrence(r, new Set(), now)).toEqual(sp('2026-11-09T08:00:00'));
  });

  it('a cada 2 horas: conclui um horário por vez', () => {
    const agua = { date: '2026-11-09', time: '08:00', repeat: 'hourly' as const, intervalHours: 2, active: true };
    const now = sp('2026-11-09T15:00:00');
    const r = { ...agua, nextAt: sp('2026-11-09T16:00:00') };
    expect(currentOccurrence(r, new Set(), now)).toEqual(sp('2026-11-09T14:00:00'));
    expect(currentOccurrence(r, ms(sp('2026-11-09T14:00:00')), now)).toEqual(sp('2026-11-09T16:00:00'));
  });

  it('pendência de ontem não aparece hoje', () => {
    const now = sp('2026-11-10T07:00:00');
    const r = { ...vitaminas, nextAt: sp('2026-11-10T08:00:00') };
    expect(currentOccurrence(r, new Set(), now)).toEqual(sp('2026-11-10T08:00:00'));
  });

  it('uma vez: até ser concluído; depois, nada', () => {
    const r = { date: '2026-11-09', time: '09:00', repeat: 'once' as const, intervalHours: null, active: false, nextAt: null };
    expect(currentOccurrence(r, new Set(), sp('2026-11-09T12:00:00'))).toEqual(sp('2026-11-09T09:00:00'));
    expect(currentOccurrence(r, ms(sp('2026-11-09T09:00:00')), sp('2026-11-09T12:00:00'))).toBeNull();
  });

  it('pausado: não fica pendente, mostra a próxima', () => {
    const now = sp('2026-11-09T10:00:00');
    const r = { ...vitaminas, active: false, nextAt: sp('2026-11-10T08:00:00') };
    expect(currentOccurrence(r, new Set(), now)).toEqual(sp('2026-11-10T08:00:00'));
  });

  it('pausado há dias: mostra o próximo horário a partir de agora, não o antigo', () => {
    const agua = { date: '2026-11-10', time: '08:00', repeat: 'hourly' as const, intervalHours: 1, active: false };
    const r = { ...agua, nextAt: sp('2026-11-10T09:00:00') }; // next_at parado desde que foi pausado
    expect(currentOccurrence(r, new Set(), sp('2026-11-13T15:20:00'))).toEqual(sp('2026-11-13T16:00:00'));
  });
});
