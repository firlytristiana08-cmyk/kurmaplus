<script lang="ts">
	import { cart } from '#lib/cart.svelte';
	import BackLink from './BackLink.svelte';
	import Wordmark from './Wordmark.svelte';

	let { backFixed = false }: { backFixed?: boolean } = $props();

	// Angka keranjang tampil di semua halaman.
	$effect(() => {
		cart.hydrate();
	});
</script>

<header class="header">
	<div class="header-inner">
		<Wordmark href="/" />
		<nav aria-label="Navigasi utama">
			<a href="/lacak">Lacak pesanan</a>
			<a
				class="cart-link"
				href="/keranjang"
				aria-label={cart.count > 0 ? `Keranjang, ${cart.count} barang` : 'Keranjang'}
			>
				<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
					<path d="M7.3 8.7v-.4a4.7 4.7 0 0 1 9.4 0v.4h-2.3v-.4a2.4 2.4 0 0 0-4.8 0v.4H7.3Z" />
					<rect x="4.5" y="8" width="15" height="13.7" rx="2.7" />
				</svg>
				{#if cart.count > 0}
					<span class="cart-badge tabular">{cart.count}</span>
				{/if}
			</a>
		</nav>
	</div>
</header>

<!-- Tombol kembali berada di luar navbar, di atas konten halaman. -->
<BackLink fixed={backFixed} />

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
		padding: 12px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.header nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	/* Ikon keranjang di ujung kanan navbar. */
	.cart-link {
		position: relative;
		width: 48px;
		justify-content: center;
	}

	.cart-link:hover {
		text-decoration: none;
		color: var(--rust);
	}

	.cart-badge {
		position: absolute;
		top: 4px;
		right: 2px;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.25rem;
		border-radius: 999px;
		background: var(--rust);
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
