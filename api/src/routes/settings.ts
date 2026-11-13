import type { FastifyInstance } from 'fastify';
import { DEFAULT_THEME, THEMES, isThemeId, settingsSchema, themeIcons, type Settings, type ThemeId } from '@gabi/shared';
import type { Db } from '../db';
import { parse } from '../lib/http';

async function currentTheme(db: Db): Promise<ThemeId> {
  const { rows } = await db.query<{ value: unknown }>(`SELECT value FROM settings WHERE key = 'theme'`);
  const v = rows[0]?.value;
  return isThemeId(v) ? v : DEFAULT_THEME;
}

/** Rotas que exigem sessão. */
export async function settingsRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/api/settings', async (): Promise<Settings> => ({ theme: await currentTheme(db) }));

  app.put('/api/settings', async (req): Promise<Settings> => {
    const s = parse(settingsSchema, req.body);
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('theme', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(s.theme)],
    );
    return s;
  });
}

/**
 * Manifest do PWA gerado conforme o tema escolhido (ícone e cores).
 * É público porque o navegador o busca sem cookie; não expõe nada além do nome do tema.
 */
export async function manifestRoute(app: FastifyInstance, { db }: { db: Db }) {
  app.get('/api/manifest.webmanifest', async (_req, reply) => {
    const theme = THEMES[await currentTheme(db)];
    const icons = themeIcons(theme.id);
    reply.header('Content-Type', 'application/manifest+json; charset=utf-8');
    reply.header('Cache-Control', 'no-cache');
    return {
      // id fixo: trocar o tema atualiza o mesmo app instalado, em vez de virar "outro app".
      id: '/',
      name: 'Gabi',
      short_name: 'Gabi',
      description: 'Tarefas, agenda, lembretes, kanban e finanças da Gabriela.',
      lang: 'pt-BR',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      theme_color: theme.colors.accent,
      background_color: theme.colors.bg,
      icons: [
        { src: icons.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icons.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: icons.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };
  });
}
