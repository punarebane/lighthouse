// Build the itch.io HTML5 upload: release/lighthouse-itch.zip with index.html at the root.
//   npm run build && npm run package
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';

if (!existsSync('dist/index.html')) throw new Error('dist/ missing: run npm run build first');
mkdirSync('release', { recursive: true });
const out = 'release/lighthouse-itch.zip';
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-9', '-q', `../${out}`, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
