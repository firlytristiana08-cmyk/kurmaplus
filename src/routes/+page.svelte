<script lang="ts">
	// Layar masuk (splash) — tampilan persis mockup yang disetujui pengguna.
</script>

<svelte:head>
	<title>KURMAPLUS — Manisnya Sunnah, Berkahnya Ramadhan</title>
	<meta
		name="description"
		content="Toko kurma sukari, ajwa, dan tunisia. Pesan dari HP, dikirim Sabtu dan Minggu ke Jabodetabek lewat Grab atau Gojek."
	/>
	<meta name="theme-color" content="#241710" />
	<link
		rel="preload"
		href="/images/hero.webp"
		as="image"
		type="image/webp"
		media="(max-width: 639px)"
	/>
	<link
		rel="preload"
		href="/images/bg-tablet.webp"
		as="image"
		type="image/webp"
		media="(min-width: 640px) and (max-width: 1023px)"
	/>
	<link
		rel="preload"
		href="/images/bg-desktop.webp"
		as="image"
		type="image/webp"
		media="(min-width: 1024px)"
	/>
</svelte:head>

<main class="page">
	<div class="canvas">
		<!-- Art direction: tiap perangkat hanya mengunduh satu gambar sesuai
		     lebar layarnya agar akses publik tetap ringan. -->
		<picture>
			<source media="(min-width: 1024px)" srcset="/images/bg-desktop.webp" type="image/webp" />
			<source media="(min-width: 640px)" srcset="/images/bg-tablet.webp" type="image/webp" />
			<img
				class="hero-bg"
				src="/images/hero.webp"
				alt="Ilustrasi kampung Jakarta dengan Monas di kejauhan"
				width="539"
				height="956"
				fetchpriority="high"
			/>
		</picture>

		<!-- Posisi kartu mengambang mengikuti mockup: ekor menunjuk ke atas
		     genteng rumah yang menyala pada tiap latar. -->
		<div class="card-anchor">
			<section class="card" aria-labelledby="brand">
				<div class="card-body">
					<div class="brand-row">
						<img class="logo" src="/images/logo-kurma.png" alt="" width="64" height="64" />
						<div class="brand-text">
							<h1 class="wordmark" id="brand">KURMA<span class="wordmark-plus">PLUS</span></h1>
							<p class="tagline">Manisnya Sunnah,<br />Berkahnya Ramadhan.</p>
						</div>
					</div>

					<a class="splash-btn" href="/katalog">
						<!-- Ikon tas belanja filled, warna mengikuti teks tombol (putih). -->
						<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M7.3 8.7v-.4a4.7 4.7 0 0 1 9.4 0v.4h-2.3v-.4a2.4 2.4 0 0 0-4.8 0v.4H7.3Z" />
							<rect x="4.5" y="8" width="15" height="13.7" rx="2.7" />
						</svg>
						Beli Kurma
					</a>
				</div>
			</section>
		</div>
	</div>
</main>

<style>
	.page {
		margin: 0;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--ink);
	}

	.canvas {
		position: relative;
		isolation: isolate;
		width: 100%;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		background: var(--ink);
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	/* Jangkar posisi kartu: ekor menunjuk ke atas genteng rumah yang menyala
	   di tiap latar (hasil ukur piksel). */
	.card-anchor {
		position: absolute;
		right: clamp(14px, 9.5vw, 51px);
		top: 38%;
		width: min(250px, calc(100vw - 28px));
		transform: translateY(-100%);
	}

	@media (min-width: 640px) {
		.card-anchor {
			right: auto;
			left: 68%;
			top: 28.5%;
			transform: translate(-65.6%, -100%);
		}
	}

	@media (min-width: 1024px) {
		.card-anchor {
			top: 26%;
		}
	}

	@media (min-width: 1024px) and (min-aspect-ratio: 2/1) {
		.card-anchor {
			top: 21%;
		}
	}

	@media (max-height: 560px) {
		.card-anchor {
			top: 72%;
		}
	}

	.card {
		position: relative;
		padding: 1.25rem;
		border-radius: var(--radius-l);
		animation: rise-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	/* Lapisan 1 — siluet badan kartu + bayangan di luar saja. */
	.card::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-color: rgb(255 255 255 / 0.88);
		border-radius: var(--radius-l);
		box-shadow:
			0 1px 0 0 rgb(255 255 255 / 0.9) inset,
			0 22px 30px -6px rgb(36 23 16 / 0.4),
			0 5px 10px -4px rgb(36 23 16 / 0.28);
	}

	/* Lapisan 2 — ekor segitiga menghadap ke bawah ke arah rumah. */
	.card::after {
		content: '';
		position: absolute;
		left: 65.6%;
		bottom: -24px;
		width: 4rem;
		height: 26px;
		z-index: -1;
		translate: -50% 0;
		background-color: rgb(255 255 255 / 0.88);
		clip-path: polygon(50% 100%, 0 0, 100% 0);
		filter: drop-shadow(0 6px 5px rgb(36 23 16 / 0.3));
	}

	.card-body {
		position: relative;
		z-index: 0;
		isolation: isolate;
	}

	.brand-row {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.logo {
		display: block;
		flex: none;
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.brand-text {
		min-width: 0;
	}

	.wordmark {
		margin: 0;
		color: var(--ink);
		font-family: 'Figtree', system-ui, sans-serif;
		font-size: 1.25rem;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}

	.wordmark-plus {
		color: var(--rust);
	}

	.tagline {
		margin: 0.25rem 0 0;
		color: var(--ink);
		font-family: 'Figtree', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.35;
	}

	.splash-btn {
		display: flex;
		width: 100%;
		min-height: 50px;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.9375rem;
		padding: 0.72rem 1rem;
		border-radius: 0.8125rem;
		background: var(--rust);
		color: #fffdf8;
		font-family: 'Figtree', system-ui, sans-serif;
		font-size: 0.96875rem;
		font-weight: 700;
		letter-spacing: -0.005em;
		text-decoration: none;
		box-shadow:
			0 8px 16px -8px rgb(171 55 16 / 0.85),
			inset 0 1px 0 rgb(255 255 255 / 0.22);
		transition:
			transform 150ms ease-out,
			background-color 150ms ease-out;
	}

	.splash-btn:active {
		transform: scale(0.975);
		background: var(--rust-press);
	}

	.splash-btn:focus-visible {
		outline: 3px solid var(--olive);
		outline-offset: 2px;
	}

	.btn-icon {
		flex: none;
		width: 1.3125rem;
		height: 1.3125rem;
	}

	@keyframes rise-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
