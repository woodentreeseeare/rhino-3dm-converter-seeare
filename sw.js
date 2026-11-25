// Service worker: caches the app shell, libraries and icons so the app works offline.
// Same-origin only. Nothing cross-origin is ever fetched.
// VERSION is replaced with the commit hash by the Pages workflow, so each deploy gets a new cache.
const VERSION = 'dev';
const CACHE = `3dm-converter-${VERSION}`;
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'app/main.js',
  'app/convert.js',
  'app/to3dm.js',
  'app/occt-worker.js',
  'app/style.css',
  'app/icons/icon-180.png',
  'app/icons/icon-192.png',
  'app/icons/icon-512.png',
  'vendor/rhino3dm.module.js',
  'vendor/rhino3dm.wasm',
  'vendor/three-loaders.js',
  'vendor/occt-import-js.js',
  'vendor/occt-import-js.wasm',
  'vendor/openskp.js',
  'vendor/VERSIONS.md',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('3dm-converter-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) { event.respondWith(Response.error()); return; }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const shell = await cache.match('index.html'); if (shell) return shell; }
    return fetch(req);
  })());
});
