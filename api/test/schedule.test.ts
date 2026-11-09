import { describe, expect, it } from 'vitest';
import { nextOccurrence } from '../src/reminders/schedule';

const sp = (local: string) => new Date(`${local}-03:00`);

describe('próxima ocorrência de lembrete', () => {
  it('uma vez: futuro ou null', () => {
    const r = { date: '2026-11-10', time: '09:00', repeat: 'once' as const, intervalHours: null };
    expect(nextOccurrence(r, sp('2026-11-09T12:00:00'))).toEqual(sp('2026-11-10T09:00:00'));
    expect(nextOccurrence(r, sp('2026-11-10T09:00:00'))).toBeNull();
  });

  it('todo dia, no horário de São Paulo', () => {
    const r = { date: '2026-01-01', time: '08:00', repeat: 'daily' as const, intervalHours: null };
    expect(nextOccurrence(r, sp('2026-11-09T08:00:00'))).toEqual(sp('2026-11-10T08:00:00'));
    expect(nextOccurrence(r, sp('2026-11-09T07:59:00'))).toEqual(sp('2026-11-09T08:00:00'));
  });

  it('todo mês no dia 31 cai no último dia de meses curtos', () => {
    const r = { date: '2026-01-31', time: '10:00', repeat: 'monthly' as const, intervalHours: null };
    expect(nextOccurrence(r, sp('2026-02-01T00:00:00'))).toEqual(sp('2026-02-28T10:00:00'));
    expect(nextOccurrence(r, sp('2026-03-01T00:00:00'))).toEqual(sp('2026-03-31T10:00:00'));
  });

  it('a cada N horas', () => {
    const r = { date: '2026-11-09', time: '08:00', repeat: 'hourly' as const, intervalHours: 2 };
    expect(nextOccurrence(r, sp('2026-11-09T15:30:00'))).toEqual(sp('2026-11-09T16:00:00'));
  });

  it('semanal e anual', () => {
    expect(
      nextOccurrence({ date: '2026-11-02', time: '09:00', repeat: 'weekly', intervalHours: null }, sp('2026-11-09T10:00:00')),
    ).toEqual(sp('2026-11-16T09:00:00'));
    expect(
      nextOccurrence({ date: '2020-11-11', time: '18:00', repeat: 'yearly', intervalHours: null }, sp('2026-11-09T10:00:00')),
    ).toEqual(sp('2026-11-11T18:00:00'));
  });
});
