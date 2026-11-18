<script lang="ts">
	import { page } from '$app/state';
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

{#if page.url.pathname !== '/'}
	<!-- Latar ilustrasi (bg-halaman) 10% — semua halaman kecuali halaman utama. -->
	<div class="halaman-bg" aria-hidden="true">
		<picture>
			<source media="(min-width: 1024px)" srcset="/images/bg-halaman-desktop.avif" type="image/avif" />
			<source media="(min-width: 1024px)" srcset="/images/bg-halaman-desktop.webp" type="image/webp" />
			<source media="(min-width: 640px)" srcset="/images/bg-halaman-tablet.avif" type="image/avif" />
			<source media="(min-width: 640px)" srcset="/images/bg-halaman-tablet.webp" type="image/webp" />
			<source srcset="/images/bg-halaman-hp.avif" type="image/avif" />
			<img src="/images/bg-halaman-hp.webp" alt="" width="1536" height="2752" />
		</picture>
	</div>
{/if}

{@render children()}
