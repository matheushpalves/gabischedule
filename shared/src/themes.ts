import type { ColorName } from './schemas';

/**
 * Temas de cor do app. Cada token vira uma variável CSS (`--<nome-em-kebab>`), aplicada em
 * tempo de execução. Tokens terminados em "Rgb" são trios "r, g, b" para usar em rgba().
 * Os testes (api/test/themes.test.ts) garantem contraste AA nas combinações de texto.
 */
export const THEME_IDS = ['rosa', 'rose', 'rosegold', 'terracota', 'cereja'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'rosa';

export interface ThemeColors {
  bg: string;
  ink: string;
  ink2: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  line: string;
  lineSoft: string;
  /** Cartões escuros (saldo, próximo lembrete). */
  heroDark: string;
  /** Filtro selecionado. */
  chipOn: string;
  /** Texto claro sobre cartões escuros. */
  onDarkSoft: string;
  avatarBg: string;
  tint: string;
  skeleton: string;
  danger: string;
  dangerBorder: string;
  dangerHover: string;
  switchOff: string;
  dashed: string;
  grip: string;
  chipOffBg: string;
  chipOffFg: string;
  barSoft: string;
  ok: string;
  incomeLabel: string;
  goalTrack: string;
  goalBar: string;
  goalIconBg: string;
  goalFg: string;
  col0Bg: string;
  col0Dot: string;
  col1Bg: string;
  col1Dot: string;
  col2Bg: string;
  col2Dot: string;
  tagRosaBg: string;
  tagRosaFg: string;
  tagLilasBg: string;
  tagLilasFg: string;
  tagVerdeBg: string;
  tagVerdeFg: string;
  tagPessegoBg: string;
  tagPessegoFg: string;
  tagAzulBg: string;
  tagAzulFg: string;
  shadowRgb: string;
  accentRgb: string;
  overlayRgb: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
  /** Nome de cada cor de etiqueta neste tema (o valor salvo continua sendo rosa/lilas/...). */
  tagLabels: Record<ColorName, string>;
}

const ORIGINAL_TAGS = {
  tagRosaBg: '#FBE3EC', tagRosaFg: '#8E1F4C',
  tagLilasBg: '#ECE4FA', tagLilasFg: '#4F2C8A',
  tagVerdeBg: '#DFF3EA', tagVerdeFg: '#1F6B4A',
  tagPessegoBg: '#FDECD9', tagPessegoFg: '#8A4A12',
  tagAzulBg: '#E3EEF9', tagAzulFg: '#1F4E7A',
};
const ORIGINAL_LABELS: Record<ColorName, string> = { rosa: 'Rosa', lilas: 'Lilás', verde: 'Verde', pessego: 'Pêssego', azul: 'Azul' };
const ORIGINAL_GOAL = { goalTrack: '#F1EAFB', goalBar: '#6B44B0', goalIconBg: '#ECE4FA', goalFg: '#4F2C8A' };
const ORIGINAL_COLS_1_2 = { col1Bg: '#F1EAFB', col1Dot: '#6B44B0', col2Bg: '#E6F4ED', col2Dot: '#2E8A60' };

/** Base terrosa da paleta da Gabi (terracota, cereja, musgo, rosé, linho). */
const EARTHY = {
  bg: '#F8F3EF', ink: '#391B0D', ink2: '#664324', line: '#DED2C9', lineSoft: '#EFE6E0',
  onDarkSoft: '#F7D1D4', avatarBg: '#F7D1D4', accentSoft: '#F7D1D4', skeleton: '#FBF7F4',
  dangerBorder: '#E6C3BD', dangerHover: '#F8EBE7', switchOff: '#D3C7BE', dashed: '#CDB8AA', grip: '#A38F83',
  chipOffBg: '#EFE8E3', chipOffFg: '#664324', barSoft: '#E3AA9B', ok: '#4E5A24', incomeLabel: '#AAB28D',
  goalTrack: '#ECEEE3', goalBar: '#808355', goalIconBg: '#E4E8D8', goalFg: '#343A1C',
  col1Bg: '#ECEEE3', col1Dot: '#808355', col2Bg: '#E9ECDF', col2Dot: '#343A1C',
  tagRosaBg: '#F7D1D4', tagRosaFg: '#722727',
  tagLilasBg: '#F3DCE8', tagLilasFg: '#6A2E52',
  tagVerdeBg: '#E4E8D8', tagVerdeFg: '#343A1C',
  tagPessegoBg: '#F6DDD5', tagPessegoFg: '#7A3B2E',
  tagAzulBg: '#EDE3DC', tagAzulFg: '#664324',
  shadowRgb: '57, 27, 13', overlayRgb: '57, 27, 13',
};
const EARTHY_LABELS: Record<ColorName, string> = { rosa: 'Rosa', lilas: 'Rosa-lilás', verde: 'Sálvia', pessego: 'Rosé', azul: 'Linho' };

export const THEMES: Record<ThemeId, Theme> = {
  rosa: {
    id: 'rosa',
    name: 'Rosa',
    description: 'O pink original do app.',
    tagLabels: ORIGINAL_LABELS,
    colors: {
      bg: '#FFF5F7', ink: '#4A1F3D', ink2: '#7A5468', accent: '#C2336A', accentDark: '#8E1F4C', accentSoft: '#FBE3EC',
      line: '#EBC3D2', lineSoft: '#F6E6EC', heroDark: '#4A1F3D', chipOn: '#4A1F3D', onDarkSoft: '#F9D5E1', avatarBg: '#F9D5E1',
      tint: '#FBE9EF', skeleton: '#FDF3F6', danger: '#A8204F', dangerBorder: '#F0C2D2', dangerHover: '#FDEEF3',
      switchOff: '#D9C4CE', dashed: '#D9A9BC', grip: '#B48A9E', chipOffBg: '#F1EAEE', chipOffFg: '#6E5563',
      barSoft: '#E89AB6', ok: '#1F6B4A', incomeLabel: '#BFEBD6', ...ORIGINAL_GOAL,
      col0Bg: '#FBE9EF', col0Dot: '#C2336A', ...ORIGINAL_COLS_1_2, ...ORIGINAL_TAGS,
      shadowRgb: '122, 40, 80', accentRgb: '194, 51, 106', overlayRgb: '74, 31, 61',
    },
  },
  rose: {
    id: 'rose',
    name: 'Rosé',
    description: 'Rosa seco, mais suave.',
    tagLabels: ORIGINAL_LABELS,
    colors: {
      bg: '#FBF4F2', ink: '#4B2A31', ink2: '#76585C', accent: '#A94C60', accentDark: '#84394A', accentSoft: '#F5E0DE',
      line: '#E6C9C8', lineSoft: '#F2E5E3', heroDark: '#4B2A31', chipOn: '#4B2A31', onDarkSoft: '#F1D5D2', avatarBg: '#F1D5D2',
      tint: '#F7E9E6', skeleton: '#FAF1EF', danger: '#A13A4A', dangerBorder: '#E8C6C6', dangerHover: '#FAEDEB',
      switchOff: '#D8C7C6', dashed: '#D2AFAF', grip: '#AE908F', chipOffBg: '#F1E9E8', chipOffFg: '#6E5859',
      barSoft: '#D6A2A6', ok: '#1F6B4A', incomeLabel: '#BFEBD6', ...ORIGINAL_GOAL,
      col0Bg: '#F7E9E6', col0Dot: '#A94C60', ...ORIGINAL_COLS_1_2, ...ORIGINAL_TAGS,
      tagRosaBg: '#F5E0DE', tagRosaFg: '#84394A',
      shadowRgb: '120, 62, 64', accentRgb: '169, 76, 96', overlayRgb: '75, 42, 49',
    },
  },
  rosegold: {
    id: 'rosegold',
    name: 'Rosé gold',
    description: 'Rosado puxado para o dourado.',
    tagLabels: ORIGINAL_LABELS,
    colors: {
      bg: '#FBF5F1', ink: '#4A2E2C', ink2: '#765C57', accent: '#9C5A50', accentDark: '#7A463E', accentSoft: '#F4E2DA',
      line: '#E5CCC2', lineSoft: '#F2E7E1', heroDark: '#4A2E2C', chipOn: '#4A2E2C', onDarkSoft: '#F0D8CE', avatarBg: '#F0D8CE',
      tint: '#F6EAE3', skeleton: '#FAF3EF', danger: '#A23D3D', dangerBorder: '#E7CABF', dangerHover: '#FAEEE9',
      switchOff: '#D9CAC4', dashed: '#D1B3A8', grip: '#AE958C', chipOffBg: '#F1EAE6', chipOffFg: '#6E5A55',
      barSoft: '#D4AA9C', ok: '#1F6B4A', incomeLabel: '#BFEBD6', ...ORIGINAL_GOAL,
      col0Bg: '#F6EAE3', col0Dot: '#9C5A50', ...ORIGINAL_COLS_1_2, ...ORIGINAL_TAGS,
      tagRosaBg: '#F4E2DA', tagRosaFg: '#7A463E',
      shadowRgb: '118, 72, 60', accentRgb: '156, 90, 80', overlayRgb: '74, 46, 44',
    },
  },
  terracota: {
    id: 'terracota',
    name: 'Terracota + musgo',
    description: 'Terracota com verde musgo e linho.',
    tagLabels: EARTHY_LABELS,
    colors: {
      ...EARTHY,
      accent: '#A94740', accentDark: '#722727', accentRgb: '169, 71, 64',
      heroDark: '#343A1C', chipOn: '#343A1C', danger: '#A94740',
      tint: '#F5E6E1', col0Bg: '#F5E6E1', col0Dot: '#A94740',
    },
  },
  cereja: {
    id: 'cereja',
    name: 'Cereja + marrom',
    description: 'Cereja com marrom e verde musgo.',
    tagLabels: EARTHY_LABELS,
    colors: {
      ...EARTHY,
      accent: '#722727', accentDark: '#561C1C', accentRgb: '114, 39, 39',
      heroDark: '#391B0D', chipOn: '#343A1C', danger: '#A94740',
      tint: '#F7E4E3', col0Bg: '#F7E4E3', col0Dot: '#722727',
    },
  },
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
}

/** Nome da variável CSS de um token: accentDark → --accent-dark, ink2 → --ink2. */
export function cssVarName(token: string): string {
  return '--' + token.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** Variáveis CSS do tema, prontas para aplicar no :root. */
export function themeCssVars(theme: Theme): Record<string, string> {
  return Object.fromEntries(Object.entries(theme.colors).map(([k, v]) => [cssVarName(k), v]));
}

/** Caminhos dos ícones de cada tema (gerados por `npm run icons -w web`). */
export function themeIcons(id: ThemeId) {
  return {
    icon192: `/icons/${id}-192.png`,
    icon512: `/icons/${id}-512.png`,
    maskable512: `/icons/${id}-maskable-512.png`,
    apple: `/icons/${id}-apple-touch-icon.png`,
  };
}
