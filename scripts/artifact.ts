// Build a single-file HTML page (all JS and CSS inlined, no code splitting) for a
// claude.ai Artifact or any single-file host:  npx tsx scripts/artifact.ts  ->  release/lighthouse-artifact.html
import { build } from 'vite';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

await build({
  configFile: false,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: 'release/artifact-build',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 1e9,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const dir = 'release/artifact-build/assets';
const files = readdirSync(dir);
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))!}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))!}`, 'utf8');
const html = `<title>Lighthouse</title>
<style>${css}</style>
<div id="game"></div>
<div id="hud"></div>
<div id="ui"></div>
<div id="loading">lighting the lamp…</div>
<script type="module">${js}</script>
`;
mkdirSync('release', { recursive: true });
writeFileSync('release/lighthouse-artifact.html', html);
console.log(`release/lighthouse-artifact.html: ${(html.length / 1024).toFixed(0)} KB`);
