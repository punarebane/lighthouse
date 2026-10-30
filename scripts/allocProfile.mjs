// Allocation check in Chromium: runs an autoplay game (or bench) on the Vite dev server
// (unminified, so function names survive), records a sampling heap profile over a window,
// and reports allocated bytes per source file / function.
//   node scripts/allocProfile.mjs [url] [seconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:5173/?seed=1&autoplay=1';
const seconds = Number(process.argv[3] ?? 15);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url);
await page.waitForFunction(() => window.__LH && window.__LH.frames > 30, null, { timeout: 60000 });
await page.waitForTimeout(5000);
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
const t0 = await page.evaluate(() => [window.__LH.frames, window.__LH.t]);
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024 });
await page.waitForTimeout(seconds * 1000);
const { profile } = await cdp.send('HeapProfiler.stopSampling');
const t1 = await page.evaluate(() => [window.__LH.frames, window.__LH.t]);
await browser.close();

const byFile = new Map();
const byFn = new Map();
let total = 0;
(function walk(node) {
  const cf = node.callFrame;
  const file = (cf.url.split('?')[0].split('/').slice(-2).join('/')) || '(native)';
  const key = `${cf.functionName || '(anon)'} @ ${file}:${cf.lineNumber + 1}`;
  if (node.selfSize > 0) {
    total += node.selfSize;
    byFile.set(file, (byFile.get(file) ?? 0) + node.selfSize);
    byFn.set(key, (byFn.get(key) ?? 0) + node.selfSize);
  }
  for (const c of node.children) walk(c);
})(profile.head);

const frames = t1[0] - t0[0];
const simSeconds = t1[1] - t0[1];
const kb = (b) => (b / 1024).toFixed(1) + ' KB';
console.log(`window: ${seconds}s wall, ${frames} frames, ${simSeconds.toFixed(1)}s of sim (${Math.round(simSeconds * 60)} ticks)`);
console.log(`sampled allocations: ${kb(total)} total, ${(total / Math.max(1, frames)).toFixed(0)} B/frame`);
console.log('\nby file:');
[...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([f, v]) => console.log(`  ${kb(v).padStart(10)}  ${f}`));
console.log('\ntop functions:');
[...byFn].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([f, v]) => console.log(`  ${kb(v).padStart(10)}  ${f}`));
const simFiles = [...byFile].filter(([f]) => f.startsWith('sim/') || f.startsWith('core/'));
console.log('\nsim/core files:', simFiles.length ? simFiles.map(([f, v]) => `${f} ${kb(v)}`).join(', ') : 'none');
