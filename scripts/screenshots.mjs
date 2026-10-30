// Capture store/ITCH screenshots from the preview build (npm run build && npm run preview first).
//   node scripts/screenshots.mjs
import { chromium } from '@playwright/test';

const base = process.env.BASE ?? 'http://localhost:4173';
const shots = [
  { name: 'gameplay-early', q: '?seed=11&autoplay=1&ff=75', wait: 3000 },
  { name: 'gameplay-leviathan', q: '?seed=4&autoplay=1&ff=318', wait: 4000 },
  { name: 'gameplay-late', q: '?seed=7&autoplay=1&ff=520', wait: 3000, meta: true },
  { name: 'gameplay-kraken', q: '?seed=21&autoplay=1&ff=640', wait: 3000, meta: true },
  { name: 'colorblind-crt', q: '?seed=11&autoplay=1&ff=230', wait: 3000, settings: { colorblind: true, crt: true } },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  if (s.settings || s.meta) {
    await page.goto(base + '/');
    await page.evaluate(([st, meta]) => {
      const save = { version: 1, coins: 0, meta: meta ? [5, 5, 5, 5, 5, 5, 5, 5] : [0, 0, 0, 0, 0, 0, 0, 0], settings: { master: 0.8, sfx: 0.8, ambience: 0.6, shake: 1, colorblind: false, crt: false, ...(st ?? {}) }, best: { time: 0, level: 0, kills: 0, wins: 0 }, runs: 0 };
      localStorage.setItem('lighthouse.save.v1', JSON.stringify(save));
    }, [s.settings ?? null, !!s.meta]);
  }
  await page.goto(base + '/' + s.q);
  await page.waitForFunction(() => window.__LH && window.__LH.frames > 5, null, { timeout: 120000 });
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: `screenshots/${s.name}.png` });
  console.log('saved', s.name, JSON.stringify(await page.evaluate(() => ({ t: window.__LH.t, level: window.__LH.level, hp: window.__LH.hp }))));
  await ctx.close();
}
await browser.close();
