<footer class="footer">
	<div class="footer-inner">
		<p class="note">
			Pengiriman Sabtu dan Minggu ke Jabodetabek lewat Grab atau Gojek. Ongkir dibayar pemesan di
			luar total pesanan.
		</p>
		<nav aria-label="Tautan tambahan">
			<a href="/info">Cara pesan</a>
			<a href="/privasi">Privasi</a>
		</nav>
	</div>
</footer>

<style>
	.footer {
		border-top: 1px solid var(--sand);
		margin-top: 2.5rem;
		padding: 1.25rem 0 calc(1.5rem + env(safe-area-inset-bottom));
	}

	.footer-inner {
		max-width: 430px;
		margin: 0 auto;
		padding: 0 16px;
	}

	.note {
		font-size: 0.8125rem;
		color: color-mix(in srgb, var(--ink) 62%, var(--paper));
		margin-bottom: 0.75rem;
	}

	nav {
		display: flex;
		gap: 1.25rem;
	}

	.footer a {
		color: var(--ink);
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
		min-height: 48px;
		display: inline-flex;
		align-items: center;
	}

	.footer a:hover {
		text-decoration: underline;
	}
</style>
