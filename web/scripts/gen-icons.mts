// Gera os ícones do PWA de cada tema ("G" em Fraunces branco sobre a cor de destaque do tema).
// Uso: npm run icons -w web   (usa o Chromium do Playwright)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';
import { THEMES, THEME_IDS, DEFAULT_THEME, themeIcons } from '../../shared/src/themes';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(join(pub, 'icons'), { recursive: true });

/** `scale` = altura do "G" em relação ao ícone. */
const html = (size: number, bg: string, scale: number) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@144,600&display=block" rel="stylesheet">
<style>html,body{margin:0;width:${size}px;height:${size}px;background:${bg}}
div{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Fraunces,Georgia,serif;
font-weight:600;color:#fff;font-size:${Math.round(size * scale)}px;line-height:1;padding-bottom:${Math.round(size * 0.03)}px;box-sizing:border-box}</style>
</head><body><div>G</div></body></html>`;

const browser = await chromium.launch();
for (const id of THEME_IDS) {
  const bg = THEMES[id].colors.accent;
  const paths = themeIcons(id);
  const targets: [string, number, number][] = [
    [paths.icon192, 192, 0.52],
    [paths.icon512, 512, 0.52],
    [paths.apple, 180, 0.52],
    // Maskable: o Android recorta em círculo, então o "G" fica dentro da área segura (80%).
    [paths.maskable512, 512, 0.4],
  ];
  for (const [path, size, scale] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(html(size, bg, scale), { waitUntil: 'networkidle' }).catch(() => {});
    await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
    await page.screenshot({ path: join(pub, path) });
    await page.close();
  }
  console.log('ícones gerados:', id);
}
await browser.close();

// Ícones na raiz (instalações antigas e fallback) = tema padrão.
const d = themeIcons(DEFAULT_THEME);
copyFileSync(join(pub, d.icon192), join(pub, 'icon-192.png'));
copyFileSync(join(pub, d.icon512), join(pub, 'icon-512.png'));
copyFileSync(join(pub, d.maskable512), join(pub, 'icon-maskable-512.png'));
copyFileSync(join(pub, d.apple), join(pub, 'apple-touch-icon.png'));
