import { build } from 'esbuild';
import fs from 'node:fs';

const common = { bundle: true, target: 'chrome124', outdir: 'dist', logLevel: 'warning' };

fs.rmSync('dist', { recursive: true, force: true });
await build({ ...common, format: 'iife', entryPoints: { content: 'src/content/main.js', generic: 'src/content/generic.js' } });
await build({
  ...common,
  format: 'esm',
  entryPoints: { sw: 'src/sw.js', offscreen: 'src/offscreen/main.js', popup: 'src/popup/popup.js' },
});
for (const [from, to] of [
  ['manifest.json', 'manifest.json'],
  ['src/offscreen/offscreen.html', 'offscreen.html'],
  ['src/popup/popup.html', 'popup.html'],
  ['src/popup/popup.css', 'popup.css'],
]) fs.copyFileSync(from, `dist/${to}`);
console.log('built dist/:', fs.readdirSync('dist').join(' '));
