<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		// Penanda untuk panel diagnostik preview (lihat src/app.html).
		if (import.meta.env.DEV) {
			(window as typeof window & { __kurmaHydrated?: boolean }).__kurmaHydrated = true;
			window.dispatchEvent(new Event('kurma:hydrated'));
		}
	});

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
