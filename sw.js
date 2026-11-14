const CACHE_NAME = 'kurmaplus-splash-v1';

// Aset layar awal disimpan sejak awal agar tetap terbuka tanpa jaringan (FR-17).
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './images/hero.webp',
  './images/logo-kurma.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/figtree-latin-400-normal.woff2',
  './fonts/figtree-latin-600-normal.woff2',
  './fonts/figtree-latin-700-normal.woff2',
  './fonts/figtree-latin-800-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          // Saat offline dan aset belum tersimpan, layar awal tetap tampil.
          .catch(() => caches.match('./index.html')),
    ),
  );
});
