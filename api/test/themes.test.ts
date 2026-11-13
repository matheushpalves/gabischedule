import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES, THEME_IDS, themeCssVars, type ThemeColors } from '@gabi/shared';

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pares texto/fundo que aparecem no app. Todos precisam de contraste AA (4,5:1). */
const TEXT_PAIRS: [keyof ThemeColors | '#FFFFFF', keyof ThemeColors | '#FFFFFF', string][] = [
  ['ink', 'bg', 'texto principal'],
  ['ink2', 'bg', 'texto secundário'],
  ['ink2', '#FFFFFF', 'texto secundário em cartão'],
  ['accent', 'bg', 'links'],
  ['#FFFFFF', 'accent', 'botões'],
  ['accentDark', 'accentSoft', 'botão "próxima coluna"'],
  ['#FFFFFF', 'heroDark', 'cartões escuros'],
  ['onDarkSoft', 'heroDark', 'rótulos nos cartões escuros'],
  ['incomeLabel', 'heroDark', '"Entradas"'],
  ['#FFFFFF', 'chipOn', 'filtro selecionado'],
  ['danger', '#FFFFFF', 'alertas'],
  ['ok', '#FFFFFF', 'valores positivos'],
  ['goalFg', '#FFFFFF', 'percentual da meta'],
  ['chipOffFg', 'chipOffBg', 'lembrete pausado'],
  ['tagRosaFg', 'tagRosaBg', 'etiqueta rosa'],
  ['tagLilasFg', 'tagLilasBg', 'etiqueta lilás'],
  ['tagVerdeFg', 'tagVerdeBg', 'etiqueta verde'],
  ['tagPessegoFg', 'tagPessegoBg', 'etiqueta pêssego'],
  ['tagAzulFg', 'tagAzulBg', 'etiqueta azul'],
];

describe('temas de cor', () => {
  it.each(THEME_IDS)('tema %s: contraste AA em todos os textos', (id) => {
    const c = THEMES[id].colors;
    const val = (k: string) => (k.startsWith('#') ? k : c[k as keyof ThemeColors]);
    for (const [fg, bg, onde] of TEXT_PAIRS) {
      expect(contrast(val(fg), val(bg)), `${id}: ${onde}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('todos os valores são cores válidas', () => {
    for (const id of THEME_IDS) {
      for (const [k, v] of Object.entries(THEMES[id].colors)) {
        expect(v, `${id}.${k}`).toMatch(k.endsWith('Rgb') ? /^\d{1,3}, \d{1,3}, \d{1,3}$/ : /^#[0-9A-F]{6}$/);
      }
    }
  });

  it('o CSS traz o tema padrão como valores iniciais (evita piscar na primeira carga)', () => {
    const css = readFileSync(new URL('../../web/src/styles.css', import.meta.url), 'utf8');
    for (const [name, value] of Object.entries(themeCssVars(THEMES.rosa))) {
      expect(css, name).toContain(`${name}: ${value};`);
    }
  });
});
