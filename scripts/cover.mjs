// itch.io cover image (630x500, plus a 2x version): a HUD-free gameplay frame with the title.
//   node scripts/cover.mjs   (needs npm run preview on :4173)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1260, height: 1000 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/');
await page.evaluate(() => localStorage.setItem('lighthouse.save.v1', JSON.stringify({ version: 1, coins: 0, meta: [5, 5, 5, 5, 5, 5, 5, 5], settings: { master: 0, sfx: 0, ambience: 0, shake: 0, colorblind: false, crt: false }, best: { time: 0, level: 0, kills: 0, wins: 0 }, runs: 0 })));
await page.goto('http://localhost:4173/?seed=21&autoplay=1&ff=636&clean=1');
await page.waitForFunction(() => window.__LH && window.__LH.frames > 5);
await page.addStyleTag({ content: '#hud, #ui { display: none !important; }' });
await page.waitForTimeout(2500);
const frame = await page.screenshot({ type: 'png' });
await ctx.close();

const bg = 'data:image/png;base64,' + frame.toString('base64');
const html = `<!doctype html><html><head><style>
  html, body { margin: 0; width: 630px; height: 500px; overflow: hidden; background: #060b14; }
  .bg { position: absolute; inset: 0; background: url(${bg}) center / cover; }
  .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(6,11,20,0.85) 0%, rgba(6,11,20,0) 38%, rgba(6,11,20,0) 72%, rgba(6,11,20,0.9) 100%); }
  h1 { position: absolute; top: 26px; width: 100%; margin: 0; text-align: center; font: 64px Georgia, 'Times New Roman', serif; letter-spacing: 0.22em; color: #ffd98a; text-shadow: 0 0 24px rgba(255,217,138,0.75); }
  p { position: absolute; bottom: 24px; width: 100%; margin: 0; text-align: center; font: 19px 'Trebuchet MS', sans-serif; color: #e8e4d8; letter-spacing: 0.04em; }
</style></head><body><div class="bg"></div><div class="shade"></div><h1>LIGHTHOUSE</h1><p>Aim the last light. Survive until dawn.</p></body></html>`;
for (const scale of [1, 2]) {
  const c = await browser.newContext({ viewport: { width: 630, height: 500 }, deviceScaleFactor: scale });
  const p = await c.newPage();
  await p.setContent(html);
  await p.waitForTimeout(300);
  const out = scale === 1 ? 'release/itch/cover-630x500.png' : 'release/itch/cover-1260x1000.png';
  await p.screenshot({ path: out });
  console.log('saved', out);
  await c.close();
}
await browser.close();
