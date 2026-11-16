const CACHE_NAME = 'kurmaplus-splash-v10';

// Aset layar awal disimpan sejak awal agar tetap terbuka tanpa jaringan (FR-17).
const PRECACHE = [
  './',
  './index.html',
  './styles.css?v=9',
  './manifest.webmanifest',
  './images/hero.webp',
  './images/logo-kurma.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/figtree-latin-400-normal.woff2',
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

  const isTextAsset =
    request.mode === 'navigate' || /\.(?:html?|css|js|webmanifest)$/i.test(new URL(request.url).pathname);

  if (isTextAsset) {
    // Teks (HTML/CSS/JS): jaringan DULU agar pembaruan selalu langsung terlihat,
    // cache hanya menjadi cadangan saat offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
    );
    return;
  }

  // Gambar dan font: cache dulu agar hemat kuota, jaringan bila belum tersimpan.
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
          // Saat offline, tampilkan versi HP yang selalu diprakache sebagai gantinya.
          .catch(() => caches.match('./images/hero.webp')),
    ),
  );
});
