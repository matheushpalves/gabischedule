// Gera os ícones do PWA ("G" em Fraunces branco sobre rosa #C2336A) usando o Chromium do Playwright.
// Uso: npm run icons -w web   (requer `playwright` disponível: npx -y playwright@1 ...)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const html = (size, padding) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@144,600&display=block" rel="stylesheet">
<style>html,body{margin:0;width:${size}px;height:${size}px;background:#C2336A}
div{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
font-family:Fraunces,Georgia,serif;font-weight:600;color:#fff;font-size:${Math.round(size * (1 - padding) * 0.78)}px;line-height:1;padding-bottom:${Math.round(size * 0.04)}px;box-sizing:border-box}</style>
</head><body><div>G</div></body></html>`;

const targets = [
  ['icon-192.png', 192, 0.12],
  ['icon-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0.12],
  // Maskable: conteúdo dentro da "safe zone" (círculo de 80%).
  ['icon-maskable-512.png', 512, 0.3],
];

const browser = await chromium.launch();
for (const [name, size, padding] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size, padding), { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({ path: join(out, name) });
  await page.close();
  console.log('gerado', name);
}
await browser.close();
