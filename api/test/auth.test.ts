import { describe, expect, it } from 'vitest';
import { acceptedCodes, dayOfMonthInSaoPaulo, isValidCode } from '../src/auth/code';
import { LOCK_MS, lockedUntil } from '../src/auth/lockout';
import { memoryAuthStore } from '../src/auth/store';
import { buildApp } from '../src/app';

const BASE = 1828;
/** Instante a partir de um horário local de São Paulo (UTC−3, sem horário de verão desde 2019). */
const sp = (local: string) => new Date(`${local}-03:00`);

describe('código do dia', () => {
  it('aceita base + dia do mês', () => {
    expect(isValidCode('1837', BASE, sp('2026-11-09T12:00:00'))).toBe(true);
    expect(isValidCode('1853', BASE, sp('2026-11-25T08:30:00'))).toBe(true);
  });

  it('rejeita códigos errados', () => {
    const now = sp('2026-11-09T12:00:00');
    for (const code of ['1836', '1838', '1828', '0000', '18370', '', 'abcd']) {
      expect(isValidCode(code, BASE, now)).toBe(false);
    }
  });

  it('usa o fuso America/Sao_Paulo e não o UTC', () => {
    // 22h do dia 9 em SP = 01h do dia 10 em UTC.
    const now = sp('2026-11-09T22:00:00');
    expect(now.getUTCDate()).toBe(10);
    expect(dayOfMonthInSaoPaulo(now)).toBe(9);
    expect(isValidCode('1837', BASE, now)).toBe(true);
    expect(isValidCode('1838', BASE, now)).toBe(false);
  });

  it('na virada do dia aceita o código de ontem por 5 minutos', () => {
    expect(isValidCode('1838', BASE, sp('2026-11-10T00:00:00'))).toBe(true); // hoje
    expect(isValidCode('1837', BASE, sp('2026-11-10T00:00:00'))).toBe(true); // ontem, tolerância
    expect(isValidCode('1837', BASE, sp('2026-11-10T00:04:59'))).toBe(true);
    expect(isValidCode('1837', BASE, sp('2026-11-10T00:05:01'))).toBe(false);
    expect(isValidCode('1837', BASE, sp('2026-11-10T00:06:00'))).toBe(false);
  });

  it('virada de mês: dia 31 → dia 1', () => {
    const now = sp('2026-11-01T00:02:00');
    expect(acceptedCodes(BASE, now)).toEqual(['1829', String(BASE + 31)]);
    expect(isValidCode('1859', BASE, now)).toBe(true);
    expect(isValidCode('1859', BASE, sp('2026-11-01T00:10:00'))).toBe(false);
  });

  it('fora da meia-noite só existe um código válido', () => {
    expect(acceptedCodes(BASE, sp('2026-11-09T00:06:00'))).toEqual(['1837']);
  });
});

describe('bloqueio por tentativas', () => {
  const t0 = new Date('2026-11-09T15:00:00Z');
  const at = (sec: number) => new Date(t0.getTime() + sec * 1000);

  it('bloqueia após 5 erros seguidos por 15 minutos', () => {
    const fails = [0, 1, 2, 3, 4].map((s) => ({ success: false, at: at(s) }));
    expect(lockedUntil(fails.slice(0, 4), at(5))).toBeNull();
    expect(lockedUntil(fails, at(5))?.getTime()).toBe(at(4).getTime() + LOCK_MS);
    expect(lockedUntil(fails, new Date(at(4).getTime() + LOCK_MS + 1))).toBeNull();
  });

  it('um acerto zera a contagem', () => {
    const list = [false, false, false, false, true, false].map((ok, i) => ({ success: ok, at: at(i) }));
    expect(lockedUntil(list, at(10))).toBeNull();
  });
});

describe('rota de login', () => {
  async function setup(now: Date) {
    const store = memoryAuthStore();
    const clock = { now };
    const app = await buildApp({
      config: { AUTH_BASE: BASE, COOKIE_SECURE: true, TRUST_PROXY: '127.0.0.1' },
      authStore: store,
      now: () => clock.now,
    });
    const login = (code: string, ip = '10.0.0.1') =>
      app.inject({ method: 'POST', url: '/api/auth/login', payload: { code }, remoteAddress: ip });
    return { app, store, clock, login };
  }

  it('código certo cria sessão em cookie httpOnly/Secure/SameSite=Strict de 30 dias', async () => {
    const now = sp('2026-11-09T12:00:00');
    const { app, login } = await setup(now);
    const res = await login('1837');
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'gabi_session');
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
    const days = ((cookie?.expires as Date).getTime() - now.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(30);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', cookies: { gabi_session: cookie!.value } });
    expect(me.statusCode).toBe(200);

    // Sair invalida a sessão
    await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { gabi_session: cookie!.value } });
    const after = await app.inject({ method: 'GET', url: '/api/auth/me', cookies: { gabi_session: cookie!.value } });
    expect(after.statusCode).toBe(401);
  });

  it('código errado responde só "Código incorreto"', async () => {
    const { login } = await setup(sp('2026-11-09T12:00:00'));
    const res = await login('1838');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Código incorreto' });
    expect(res.body).not.toMatch(/1828|1837|base|dia/i);
  });

  it('rotas protegidas exigem sessão', async () => {
    const { app } = await setup(sp('2026-11-09T12:00:00'));
    expect((await app.inject({ method: 'GET', url: '/api/tasks' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', cookies: { gabi_session: 'forjado' } })).statusCode).toBe(401);
  });

  it('bloqueia o IP por 15 minutos após 5 erros, mesmo com o código certo', async () => {
    const now = sp('2026-11-09T12:00:00');
    const { clock, login, store } = await setup(now);
    for (let i = 0; i < 4; i++) expect((await login('0000')).statusCode).toBe(401);
    expect((await login('0000')).statusCode).toBe(429);

    const blocked = await login('1837');
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Tentativas durante o bloqueio não são registradas.
    expect(store.attempts.get('10.0.0.1')).toHaveLength(5);

    // Outro IP não é afetado.
    expect((await login('1837', '10.0.0.2')).statusCode).toBe(200);

    clock.now = new Date(now.getTime() + 15 * 60 * 1000 + 1000);
    expect((await login('1837')).statusCode).toBe(200);
  });

  it('a tolerância de meia-noite vale também na rota', async () => {
    const { login, clock } = await setup(sp('2026-11-10T00:03:00'));
    expect((await login('1837')).statusCode).toBe(200);
    clock.now = sp('2026-11-10T00:07:00');
    expect((await login('1837')).statusCode).toBe(401);
  });
});
