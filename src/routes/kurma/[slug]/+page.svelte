<script lang="ts">
	import { formatRupiah, formatWeight } from '#lib/format';
	import { cart } from '#lib/cart.svelte';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { ProductData } from './+page.server';

	let { data }: { data: ProductData } = $props();

	let selectedVariantId = $state(0);
	let qty = $state(1);
	let added = $state(false);

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
		added = false;
	}

	function addToCart(): void {
		if (!selectedVariant || selectedVariant.stock < 1) {
			return;
		}
		cart.add(selectedVariant.id, qty);
		added = true;
	}
</script>

<svelte:head>
	<title>{product.name} — KURMAPLUS</title>
	<meta name="description" content={`${product.name}. ${product.description.slice(0, 120)}`} />
</svelte:head>

<PageHeader />

<main class="wrap">
	<article>
		<img
			class="photo"
			src={`/images/${product.photo}`}
			alt={`Foto ${product.name}`}
			width="430"
			height="300"
		/>
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
		<div class="sticky-inner">
			{#if added}
				<a class="btn" href="/keranjang">Lihat keranjang ({cart.count} barang)</a>
			{:else}
				<button type="button" class="btn" onclick={addToCart} disabled={selectedVariant.stock < 1}>
					<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M7.3 8.7v-.4a4.7 4.7 0 0 1 9.4 0v.4h-2.3v-.4a2.4 2.4 0 0 0-4.8 0v.4H7.3Z" />
						<rect x="4.5" y="8" width="15" height="13.7" rx="2.7" />
					</svg>
					Tambah ke keranjang · {formatRupiah(selectedVariant.priceIdr * qty)}
				</button>
			{/if}
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
</style>
