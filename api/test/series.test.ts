import { describe, expect, it } from 'vitest';
import { nextNotifyAt, occurrenceDates } from '../src/events/series';

const sp = (local: string) => new Date(`${local}-03:00`);

describe('repetição de compromissos', () => {
  it('não repete: só a própria data', () => {
    expect(occurrenceDates({ date: '2026-11-13', repeat: 'once', repeatUntil: null }, '2026-11-09', '2026-11-15')).toEqual(['2026-11-13']);
    expect(occurrenceDates({ date: '2026-11-13', repeat: 'once', repeatUntil: null }, '2026-11-16', '2026-11-22')).toEqual([]);
  });

  it('toda semana, a partir da data inicial', () => {
    const s = { date: '2026-11-13', repeat: 'weekly' as const, repeatUntil: null };
    expect(occurrenceDates(s, '2026-11-09', '2026-11-15')).toEqual(['2026-11-13']);
    expect(occurrenceDates(s, '2026-11-16', '2026-11-29')).toEqual(['2026-11-20', '2026-11-27']);
    expect(occurrenceDates(s, '2026-11-02', '2026-11-08')).toEqual([]); // antes do início
    expect(occurrenceDates(s, '2030-01-01', '2030-01-07')).toEqual(['2030-01-04']); // bem no futuro
  });

  it('respeita "repetir até"', () => {
    const s = { date: '2026-11-13', repeat: 'weekly' as const, repeatUntil: '2026-11-25' };
    expect(occurrenceDates(s, '2026-11-09', '2026-12-31')).toEqual(['2026-11-13', '2026-11-20']);
  });

  it('todo mês no dia 31 e todo dia', () => {
    expect(occurrenceDates({ date: '2026-01-31', repeat: 'monthly', repeatUntil: null }, '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(occurrenceDates({ date: '2020-01-01', repeat: 'daily', repeatUntil: null }, '2026-11-09', '2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
  });
});

describe('notificação antes do compromisso', () => {
  const plantao = { date: '2026-11-13', startTime: '19:00', repeat: 'weekly' as const, repeatUntil: null, notifyMinutes: 60 };

  it('1 hora antes, no fuso de São Paulo', () => {
    expect(nextNotifyAt(plantao, sp('2026-11-09T12:00:00'))).toEqual(sp('2026-11-13T18:00:00'));
  });

  it('depois de enviar, agenda a próxima semana', () => {
    expect(nextNotifyAt(plantao, sp('2026-11-13T18:00:00'))).toEqual(sp('2026-11-20T18:00:00'));
  });

  it('1 dia antes pode cair no dia anterior', () => {
    expect(nextNotifyAt({ ...plantao, notifyMinutes: 1440 }, sp('2026-11-09T12:00:00'))).toEqual(sp('2026-11-12T19:00:00'));
  });

  it('sem notificação, ou série encerrada, não agenda nada', () => {
    expect(nextNotifyAt({ ...plantao, notifyMinutes: null }, sp('2026-11-09T12:00:00'))).toBeNull();
    expect(nextNotifyAt({ ...plantao, repeatUntil: '2026-11-13' }, sp('2026-11-13T18:00:00'))).toBeNull();
    expect(nextNotifyAt({ ...plantao, repeat: 'once' }, sp('2026-11-13T18:30:00'))).toBeNull();
  });
});
