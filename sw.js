// Текстовые инструменты — офлайн-кэш.
// При каждой новой версии меняйте VERSION (и APP_VERSION в index.html): по изменению этого файла
// браузер узнаёт, что есть обновление, и показывает полосу «Доступна новая версия».
const VERSION = '2026-11-12.25';
const PREFIX = 'text-tools-';            // кэши других приложений на этом адресе не трогаем
const CACHE = PREFIX + VERSION;
const ASSETS = ['index.html', 'help.part', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

// Файлы скачиваются с меткой версии в адресе (?v=…), чтобы сервер GitHub не подсунул старую копию из своего кэша
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async u => {
      const r = await fetch(u + '?v=' + VERSION, { cache: 'no-store' });
      if (!r.ok) throw new Error(u + ': ' + r.status);
      await c.put(u, r);
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const base = new URL('./', self.registration.scope).pathname;          // /text-tools/
  // приложение — только сама страница; любые другие адреса (например, sw.js) идут в сеть как есть
  if (req.mode === 'navigate') {
    if (url.pathname === base || url.pathname === base + 'index.html') {
      e.respondWith(caches.match('index.html', { cacheName: CACHE }).then(r => r || fetch(req)));
    }
    return;
  }
  const name = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : '';
  if (ASSETS.includes(name)) e.respondWith(caches.match(name, { cacheName: CACHE }).then(r => r || fetch(req)));
});
