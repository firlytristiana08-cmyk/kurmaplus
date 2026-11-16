// Service worker portal KURMAPLUS (FR-17): katalog dan halaman info terbuka
// tanpa internet, checkout menampilkan pesan jelas saat offline. Teks selalu
// jaringan-dulu agar pembaruan tidak tersembunyi cache; gambar/font
// cache-dulu karena berkas hasil build bersifat kekal.

const CACHE_NAME = 'kurmaplus-portal-v12';

const PRECACHE = ['./', './offline.html', './katalog', './info', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') {
		return;
	}
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) {
		return;
	}

	const isTextAsset =
		request.mode === 'navigate' ||
		/\.(?:html?|css|js|json|webmanifest|txt)$/i.test(url.pathname);

	if (isTextAsset) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
					}
					return response;
				})
				.catch(
					() =>
						caches.match(request).then((cached) => cached ?? caches.match('./offline.html'))
				)
		);
		return;
	}

	// Gambar dan font: cache dulu, baru jaringan.
	event.respondWith(
		caches.match(request).then(
			(cached) =>
				cached ??
				fetch(request).then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
					}
					return response;
				})
		)
	);
});
