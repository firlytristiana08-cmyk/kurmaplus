<script lang="ts">
	import '../app.css';

	let { children } = $props();

	if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('/sw.js').catch(() => {
				/* pendaftaran service worker bersifat opsional */
			});
		});
	}
</script>

{@render children()}
