// End-to-end check in headless Chromium at iPhone size. Serves the repo, converts every
// file in samples/ (and samples/third-party/ if present), then reads each .3dm back.
// Usage: node tests/browser.test.mjs
import { createRequire } from 'node:module';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const rhino = await require('../tools/node_modules/rhino3dm/rhino3dm.js')();

const root = resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain' };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !existsSync(p) || p.endsWith('/')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const dirs = ['samples', 'samples/third-party'].filter((d) => existsSync(join(root, d)));
const files = dirs.flatMap((d) => readdirSync(join(root, d)).filter((f) => /\.[a-z0-9]+$/i.test(f)).map((f) => join(root, d, f)));

const browser = await chromium.launch();
// BYPASS_CSP=1 is for diagnosing readers only; it does not change the shipped page.
const context = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, bypassCSP: process.env.BYPASS_CSP === '1' });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(String(e)));
await page.goto(url);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
let failed = 0;
const rows = [];
for (const f of files) {
  const name = f.split('/').pop();
  await page.setInputFiles('#file', f);
  await page.click('#convert');
  await page.waitForFunction(() => {
    const s = document.getElementById('status');
    return s.classList.contains('error') || s.textContent.startsWith('Done');
  }, null, { timeout: 120000 });
  const status = await page.textContent('#status');
  const isError = await page.evaluate(() => document.getElementById('status').classList.contains('error'));
  if (isError) { rows.push({ name, result: 'ERROR', detail: status }); if (!name.startsWith('legacy_empty')) failed++; continue; }
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const bytes = readFileSync(await dl.path());
  const doc = rhino.File3dm.fromByteArray(new Uint8Array(bytes));
  const objs = doc.objects();
  let faces = 0; const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < objs.count; i++) {
    const g = objs.get(i).geometry(); faces += g.faces().count;
    const b = g.getBoundingBox(); for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], b.min[k]); bb[k + 3] = Math.max(bb[k + 3], b.max[k]); }
  }
  const size = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map((v) => +v.toFixed(2));
  const unit = Object.keys(rhino.UnitSystem).find((k) => rhino.UnitSystem[k] === doc.settings().modelUnitSystem) || doc.settings().modelUnitSystem.constructor?.name;
  rows.push({ name, result: 'OK', objects: objs.count, layers: doc.layers().count, faces, size: size.join(' x '), unit: String(doc.settings().modelUnitSystem.value ?? unit), kb: (bytes.length / 1024).toFixed(1) });
  if (!objs.count || !faces) failed++;
}
console.table(rows);
console.log('horizontal overflow:', overflow);
const realProblems = problems.filter((p) => !/could not be read|No mesh/.test(p));
if (realProblems.length) console.log('console errors:', realProblems.slice(0, 10));
await page.screenshot({ path: join(root, 'tests', 'screenshot.png') });
await browser.close(); server.close();
if (failed || overflow) { console.log('FAIL', failed); process.exit(1); }
console.log('PASS');
