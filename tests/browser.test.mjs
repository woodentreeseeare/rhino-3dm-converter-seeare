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
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const p = join(root, path);
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/index.html`;

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

const fits = (pg) => pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth);
let failed = 0;
let overflow = false;
const crossOrigin = [];
page.on('request', (r) => { if (!r.url().startsWith(`${origin}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) crossOrigin.push(r.url()); });

// Page fits at common iPhone widths with no horizontal scroll.
for (const w of [320, 375, 390, 430]) {
  await page.setViewportSize({ width: w, height: 800 });
  if (!(await fits(page))) { console.log(`horizontal scroll at ${w}px`); overflow = true; }
}
await page.setViewportSize(devices['iPhone 13'].viewport);

// iOS greys out files (such as .skp) that are not in an accept list, so the picker must have none.
if (await page.getAttribute('#file', 'accept') !== null) { console.log('#file must not have an accept attribute (iOS greys out .skp)'); failed++; }

// Service worker registers, activates and caches every file it lists.
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  const sw = reg.active;
  if (sw.state !== 'activated') await new Promise((res) => sw.addEventListener('statechange', () => sw.state === 'activated' && res()));
  return sw.state;
});
if (swState !== 'activated') { console.log('service worker not active:', swState); failed++; }
const swSource = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = [...swSource.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const cache = await caches.open(names[0]);
  return (await cache.keys()).map((r) => new URL(r.url).pathname.replace(/^\//, ''));
});
const missing = listed.filter((f) => f !== './' && !cached.includes(f));
if (missing.length) { console.log('listed but not cached:', missing); failed++; }
// Every shipped runtime file must be in the list.
const shipped = ['index.html', 'manifest.webmanifest', ...['app', 'vendor'].flatMap((d) => readdirSync(join(root, d), { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && !e.parentPath.includes('licenses') && !/SHA256SUMS/.test(e.name)).map((e) => join(d, e.parentPath.slice(join(root, d).length), e.name).replace(/\\/g, '/')))];
const notListed = shipped.filter((f) => !listed.includes(f));
if (notListed.length) { console.log('shipped but not in service worker list:', notListed); failed++; }
if (!/^const VERSION = '/m.test(swSource)) { console.log('sw.js has no VERSION'); failed++; }

const rows = [];
async function convertAll(pg, label) {
  for (const f of files) {
    const name = f.split('/').pop();
    await pg.setInputFiles('#file', f);
    await pg.click('#convert');
    await pg.waitForFunction(() => {
      const s = document.getElementById('status');
      return s.classList.contains('error') || s.textContent.startsWith('Done');
    }, null, { timeout: 120000 });
    const status = await pg.textContent('#status');
    const isError = await pg.evaluate(() => document.getElementById('status').classList.contains('error'));
    if (!(await fits(pg))) { console.log(`horizontal scroll after converting ${name}`); overflow = true; }
    if (isError) { rows.push({ run: label, name, result: 'ERROR', detail: status }); if (!name.startsWith('legacy_empty')) failed++; continue; }
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#download')]);
    const bytes = readFileSync(await dl.path());
    const doc = rhino.File3dm.fromByteArray(new Uint8Array(bytes));
    const objs = doc.objects();
    let faces = 0; const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < objs.count; i++) {
      const g = objs.get(i).geometry(); faces += g.faces().count;
      const b = g.getBoundingBox(); for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], b.min[k]); bb[k + 3] = Math.max(bb[k + 3], b.max[k]); }
    }
    const size = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map((v) => +v.toFixed(2));
    rows.push({ run: label, name, result: 'OK', objects: objs.count, layers: doc.layers().count, faces, size: size.join(' x '), unit: String(doc.settings().modelUnitSystem.value ?? doc.settings().modelUnitSystem), kb: (bytes.length / 1024).toFixed(1) });
    if (!objs.count || !faces) failed++;
  }
}
await convertAll(page, 'online');

// Offline: stop the server, cut the network, reload, and convert every sample again.
await context.setOffline(true);
server.closeAllConnections(); server.close();
await page.reload();
const offlineTitle = await page.title();
if (offlineTitle !== '3DM Converter') { console.log('offline reload failed, title:', offlineTitle); failed++; }
else {
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) { console.log('page not controlled by service worker offline'); failed++; }
  await convertAll(page, 'offline');
}
console.table(rows);
console.log('horizontal overflow:', overflow);
const realProblems = problems.filter((p) => !/could not be read|No mesh/.test(p));
if (crossOrigin.length) { console.log('cross-origin requests:', crossOrigin); failed++; }
if (realProblems.length) console.log('console errors:', realProblems.slice(0, 10));
await page.screenshot({ path: join(root, 'tests', 'screenshot.png') });
await browser.close();
if (failed || overflow) { console.log('FAIL', failed); process.exit(1); }
console.log('PASS');
