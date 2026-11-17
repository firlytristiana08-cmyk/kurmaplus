<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatRupiah, formatWeight } from '#lib/format';
	import { cart } from '#lib/cart.svelte';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { ProductData } from './+page.server';

	let { data }: { data: ProductData } = $props();

	let selectedVariantId = $state(0);
	let qty = $state(1);

	// Galeri foto (slide) + tampilan foto penuh.
	let galleryEl = $state<HTMLElement | null>(null);
	let activeSlide = $state(0);
	let lightbox = $state<number | null>(null);
	let lightboxEl = $state<HTMLElement | null>(null);
	let lightboxIndex = $state(0);

	const product = $derived(data.product);
	const selectedVariant = $derived(
		product.variants.find((variant) => variant.id === selectedVariantId) ?? product.variants[0]
	);

	$effect(() => {
		cart.hydrate();
	});

	function selectVariant(id: number): void {
		selectedVariantId = id;
		qty = 1;
	}

	function addAndGoCart(): void {
		if (!selectedVariant || selectedVariant.stock < 1) return;
		cart.add(selectedVariant.id, qty);
		goto('/keranjang');
	}

	function buyNow(): void {
		if (!selectedVariant || selectedVariant.stock < 1) return;
		cart.add(selectedVariant.id, qty);
		goto('/checkout');
	}

	function slideIndexOf(track: HTMLElement): number {
		return Math.round(track.scrollLeft / (track.clientWidth || 1));
	}

	function onGalleryScroll(): void {
		if (galleryEl) activeSlide = slideIndexOf(galleryEl);
	}

	function goToSlide(index: number): void {
		galleryEl?.scrollTo({ left: index * (galleryEl.clientWidth || 1), behavior: 'smooth' });
	}

	function openLightbox(index: number): void {
		lightboxIndex = index;
		lightbox = index;
	}

	function closeLightbox(): void {
		lightbox = null;
	}

	function onLightboxScroll(): void {
		if (lightboxEl) lightboxIndex = slideIndexOf(lightboxEl);
	}

	function goLightboxSlide(index: number): void {
		lightboxEl?.scrollTo({ left: index * (lightboxEl.clientWidth || 1), behavior: 'smooth' });
	}

	$effect(() => {
		// Saat foto penuh tampil: kunci scroll halaman dan posisikan slide.
		if (lightbox !== null && lightboxEl) {
			document.body.style.overflow = 'hidden';
			lightboxEl.scrollTo({ left: lightboxIndex * (lightboxEl.clientWidth || 1) });
			return () => {
				document.body.style.overflow = '';
			};
		}
	});
</script>

<svelte:head>
	<title>{product.name} — KURMAPLUS</title>
	<meta name="description" content={`${product.name}. ${product.description.slice(0, 120)}`} />
</svelte:head>

<PageHeader />

<main class="wrap">
	<article>
		{#if data.photos.length > 1}
			<div class="gallery-wrap">
				<div
					class="gallery"
					role="group"
					aria-label={`Foto ${product.name}`}
					bind:this={galleryEl}
					onscroll={onGalleryScroll}
				>
					{#each data.photos as photo, index (photo)}
						<button type="button" class="slide" onclick={() => openLightbox(index)}>
							<img
								src={`/images/${photo}`}
								alt={`Foto ${product.name} ${index + 1}`}
								width="860"
								height="600"
								loading={index === 0 ? 'eager' : 'lazy'}
							/>
						</button>
					{/each}
				</div>
				<div class="dots" role="group" aria-label="Pilih foto">
					{#each data.photos as photo, index (photo)}
						<button
							type="button"
							class="dot"
							class:is-active={index === activeSlide}
							aria-label={`Foto ${index + 1}`}
							onclick={() => goToSlide(index)}
						></button>
					{/each}
				</div>
			</div>
		{:else}
			<button type="button" class="photo-btn" onclick={() => openLightbox(0)}>
				<img
					class="photo"
					src={`/images/${product.photo}`}
					alt={`Foto ${product.name}`}
					width="430"
					height="300"
				/>
			</button>
		{/if}
		<h1>{product.name}</h1>
		<p class="description">{product.description}</p>

		<hr class="divider" />

		<h2>Pilih ukuran</h2>
		<div class="size-grid" role="group" aria-label="Pilihan ukuran">
			{#each product.variants as variant (variant.id)}
				<button
					type="button"
					class="size-btn"
					class:selected={variant.id === selectedVariant?.id}
					disabled={variant.stock < 1}
					onclick={() => selectVariant(variant.id)}
				>
					<span class="size-weight">{formatWeight(variant.weightGrams)}</span>
					<span class="size-price tabular">{formatRupiah(variant.priceIdr)}</span>
					{#if variant.stock < 1}
						<span class="badge badge-off">Habis</span>
					{:else if variant.stock <= 5}
						<span class="badge badge-alert">Sisa {variant.stock}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if selectedVariant}
			<div class="qty-row">
				<span class="qty-label" id="qty-label">Jumlah</span>
				<div class="qty-stepper" role="group" aria-labelledby="qty-label">
					<button
						type="button"
						class="qty-btn"
						aria-label="Kurangi jumlah"
						disabled={qty <= 1}
						onclick={() => (qty = Math.max(1, qty - 1))}
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
							<rect x="5" y="11" width="14" height="2.4" rx="1.2" />
						</svg>
					</button>
					<span class="qty-value tabular" aria-live="polite">{qty}</span>
					<button
						type="button"
						class="qty-btn"
						aria-label="Tambah jumlah"
						disabled={qty >= Math.min(99, selectedVariant.stock)}
						onclick={() => (qty = Math.min(Math.min(99, selectedVariant.stock), qty + 1))}
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
							<rect x="5" y="11" width="14" height="2.4" rx="1.2" />
							<rect x="10.8" y="5" width="2.4" height="14" rx="1.2" />
						</svg>
					</button>
				</div>
			</div>
			<p class="muted">
				Stok {formatWeight(selectedVariant.weightGrams)}: {selectedVariant.stock} paket tersedia.
				Harga dan stok dikunci ulang oleh server saat checkout.
			</p>
		{/if}
	</article>
</main>

{#if selectedVariant}
	<div class="sticky-bar">
		<div class="sticky-inner two-buttons">
			<button
				type="button"
				class="btn btn-secondary"
				onclick={addAndGoCart}
				disabled={selectedVariant.stock < 1}
			>
				<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M7.3 8.7v-.4a4.7 4.7 0 0 1 9.4 0v.4h-2.3v-.4a2.4 2.4 0 0 0-4.8 0v.4H7.3Z" />
					<rect x="4.5" y="8" width="15" height="13.7" rx="2.7" />
				</svg>
				Keranjang
			</button>
			<button type="button" class="btn" onclick={buyNow} disabled={selectedVariant.stock < 1}>
				Beli langsung
			</button>
		</div>
	</div>
{/if}

{#if lightbox !== null && data.photos.length > 0}
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label={`Foto ${product.name}`}
		tabindex="-1"
		onclick={closeLightbox}
		onkeydown={(event) => event.key === 'Escape' && closeLightbox()}
	>
		<button type="button" class="lightbox-close" onclick={closeLightbox} aria-label="Tutup foto">
			<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
				<path
					d="M12 10.66 6.3 4.9 4.9 6.3l5.7 5.7-5.7 5.7 1.4 1.4 5.7-5.7 5.7 5.7 1.4-1.4-5.7-5.7 5.7-5.7-1.4-1.4-5.7 5.7Z"
				/>
			</svg>
		</button>
		<div
			class="lightbox-track"
			bind:this={lightboxEl}
			onscroll={onLightboxScroll}
			onclick={(event) => event.stopPropagation()}
			role="presentation"
		>
			{#each data.photos as photo, index (photo)}
				<img src={`/images/${photo}`} alt={`Foto ${product.name} ${index + 1}`} />
			{/each}
		</div>
		<div class="dots" role="group" aria-label="Pilih foto">
			{#each data.photos as photo, index (photo)}
				<button
					type="button"
					class="dot"
					class:is-active={index === lightboxIndex}
					aria-label={`Foto ${index + 1}`}
					onclick={() => goLightboxSlide(index)}
				></button>
			{/each}
		</div>
	</div>
{/if}

<PageFooter />

<style>
	/* Foto mengikuti margin kiri-kanan yang sama seperti halaman lain. */
	.photo {
		width: 100%;
		aspect-ratio: 43 / 30;
		object-fit: cover;
		border-radius: var(--radius-m);
	}

	article {
		padding-top: 0;
	}

	h1 {
		margin-top: 1.125rem;
	}

	.description {
		color: color-mix(in srgb, var(--ink) 82%, var(--paper));
	}

	.size-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.625rem;
		margin-bottom: 1.125rem;
	}

	.size-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		min-height: 72px;
		padding: 0.75rem 0.875rem;
		border: 1.5px solid transparent;
		border-radius: var(--radius-m);
		background: var(--card);
		font-family: inherit;
		cursor: pointer;
	}

	/* Hanya tombol ukuran yang aktif yang memakai border. */
	.size-btn.selected {
		border-color: var(--rust);
		background: color-mix(in srgb, var(--rust) 7%, var(--card));
	}

	.size-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.size-weight {
		font-weight: 700;
		font-size: 1.0625rem;
	}

	.size-price {
		color: var(--rust);
		font-weight: 700;
		font-size: 0.875rem;
	}

	.qty-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.5rem 0 0.5rem;
	}

	.qty-label {
		font-weight: 700;
	}

	.qty-stepper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.qty-btn {
		width: 48px;
		height: 48px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--sand);
		border-radius: var(--radius-s);
		background: var(--card);
		color: var(--ink);
		cursor: pointer;
	}

	.qty-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.qty-value {
		min-width: 2.5rem;
		text-align: center;
		font-weight: 700;
		font-size: 1.125rem;
	}

	.btn-icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Galeri foto yang bisa digeser. */
	.gallery-wrap {
		margin-bottom: 0.5rem;
	}

	.gallery {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		border-radius: var(--radius-m);
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.gallery::-webkit-scrollbar {
		display: none;
	}

	.slide {
		flex: 0 0 100%;
		scroll-snap-align: start;
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
		display: block;
	}

	.slide img {
		width: 100%;
		aspect-ratio: 43 / 30;
		object-fit: cover;
		border-radius: var(--radius-m);
		display: block;
	}

	.photo-btn {
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
		display: block;
		width: 100%;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.dot {
		width: 48px;
		height: 48px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		cursor: pointer;
	}

	.dot::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 25%, var(--paper));
	}

	.dot.is-active::before {
		width: 20px;
		border-radius: 999px;
		background: var(--rust);
	}

	/* Foto penuh (lightbox). */
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(20, 16, 32, 0.92);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
	}

	.lightbox-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 48px;
		height: 48px;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.lightbox-track {
		display: flex;
		width: 100%;
		max-width: 430px;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}

	.lightbox-track::-webkit-scrollbar {
		display: none;
	}

	.lightbox-track img {
		flex: 0 0 100%;
		scroll-snap-align: start;
		width: 100%;
		max-height: 70vh;
		object-fit: contain;
	}

	.lightbox .dots {
		margin: 0;
	}

	.lightbox .dot::before {
		background: rgba(255, 255, 255, 0.45);
	}

	.lightbox .dot.is-active::before {
		background: #fff;
	}

	/* Tombol bawah: keranjang + beli langsung. */
	.two-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
	}

	.two-buttons .btn {
		justify-content: center;
	}
</style>
