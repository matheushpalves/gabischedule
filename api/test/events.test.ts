import { describe, expect, it } from 'vitest';
import { endsNextDay, eventInputSchema } from '@gabi/shared';

describe('compromissos que atravessam a meia-noite', () => {
  const base = { title: 'Plantão Noturno 6h', place: 'HSP', date: '2026-11-13', color: 'pessego' as const };

  it('aceita fim antes do início (termina no dia seguinte)', () => {
    const e = eventInputSchema.parse({ ...base, startTime: '19:00', endTime: '01:00' });
    expect(endsNextDay(e)).toBe(true);
  });

  it('compromisso no mesmo dia continua normal', () => {
    expect(endsNextDay(eventInputSchema.parse({ ...base, startTime: '10:00', endTime: '11:00' }))).toBe(false);
  });

  it('rejeita fim igual ao início', () => {
    expect(eventInputSchema.safeParse({ ...base, startTime: '19:00', endTime: '19:00' }).success).toBe(false);
  });
});
