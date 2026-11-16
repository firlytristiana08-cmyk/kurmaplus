<script lang="ts">
	import '../app.css';

	let { children } = $props();

	if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
		if (import.meta.env.DEV) {
			// Pratinjau pengembangan: lepas service worker dan cache lamanya agar
			// tampilan tidak berkedip oleh sisa cache masa pakai sebelumnya.
			navigator.serviceWorker
				.getRegistrations()
				.then((registrations) => {
					for (const registration of registrations) {
						registration.unregister();
					}
					return caches.keys();
				})
				.then((keys) =>
					Promise.all(
						keys.filter((key) => key.startsWith('kurmaplus')).map((key) => caches.delete(key)),
					),
				)
				.catch(() => {
					/* pembersihan bersifat opsional */
				});
		} else {
			window.addEventListener('load', () => {
				navigator.serviceWorker.register('/sw.js').catch(() => {
					/* pendaftaran service worker bersifat opsional */
				});
			});
		}
	}
</script>

{@render children()}
