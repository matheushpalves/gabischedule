import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, THEMES, isThemeId, themeCssVars, themeIcons, type Settings, type Theme, type ThemeId } from '@gabi/shared';
import { api, put } from './api';

/** Chave do cache local. O script em index.html lê a mesma chave para pintar o tema antes do React carregar. */
const STORAGE_KEY = 'gabi:theme';

interface CachedTheme {
  id: ThemeId;
  vars: Record<string, string>;
  themeColor: string;
  appleIcon: string;
}

function faviconDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><text x="32" y="42" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="600" font-size="32" fill="#fff">G</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Aplica o tema na página: variáveis CSS, cor da barra do navegador, favicon e ícone da Tela de Início (iOS). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const vars = themeCssVars(theme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.accent);
  setLink('icon', faviconDataUrl(theme.colors.accent));
  // O iOS lê este link no momento em que a pessoa toca em "Adicionar à Tela de Início".
  setLink('apple-touch-icon', themeIcons(theme.id).apple);
  const cached: CachedTheme = { id: theme.id, vars, themeColor: theme.colors.accent, appleIcon: themeIcons(theme.id).apple };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    /* armazenamento indisponível: o tema vem do servidor na próxima abertura */
  }
}

function cachedThemeId(): ThemeId {
  try {
    const id = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CachedTheme | null)?.id;
    return isThemeId(id) ? id : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

interface ThemeContextValue {
  theme: Theme;
  /** Troca o tema na hora e salva no servidor (vale para todos os aparelhos). */
  setTheme: (id: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: THEMES[DEFAULT_THEME], setTheme: async () => {} });

/** Dentro da área logada: busca o tema salvo no servidor e o mantém aplicado. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeId>(cachedThemeId);

  useEffect(() => {
    applyTheme(THEMES[id]);
  }, [id]);

  useEffect(() => {
    api<Settings>('/settings').then(
      (s) => setId(s.theme),
      () => {
        /* offline: mantém o tema do cache */
      },
    );
  }, []);

  const setTheme = useCallback(async (next: ThemeId) => {
    const previous = id;
    setId(next);
    try {
      await put('/settings', { theme: next });
    } catch (err) {
      setId(previous);
      throw err;
    }
  }, [id]);

  return <ThemeContext.Provider value={{ theme: THEMES[id], setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
