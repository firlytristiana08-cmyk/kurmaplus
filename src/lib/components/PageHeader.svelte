<script lang="ts">
	import Wordmark from './Wordmark.svelte';

	// Tombol teks "Kembali": riwayat bila ada, selain itu ke layar masuk.
	function goBack(event: MouseEvent): void {
		if (window.history.length > 1) {
			event.preventDefault();
			window.history.back();
		}
	}
</script>

<header class="header">
	<div class="header-inner">
		<a class="back-link" href="/" onclick={goBack}>Kembali</a>
		<Wordmark href="/katalog" />
		<nav aria-label="Navigasi utama">
			<a href="/lacak">Lacak pesanan</a>
		</nav>
	</div>
</header>

<style>
	/* Navbar tetap terlihat di atas saat halaman di-scroll. */
	.header {
		position: sticky;
		top: 0;
		z-index: 30;
		border-bottom: 1px solid var(--sand);
		background: var(--paper);
	}

	.header-inner {
		max-width: 430px;
		margin: 0 auto;
		padding: 8px 16px;
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.back-link {
		color: var(--ink);
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
		min-height: 48px;
		display: inline-flex;
		align-items: center;
		flex: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	nav {
		margin-left: auto;
	}

	.header a {
		color: var(--ink);
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
		min-height: 48px;
		display: inline-flex;
		align-items: center;
	}

	.header a:hover {
		text-decoration: underline;
	}
</style>
