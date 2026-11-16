<script lang="ts">
	import { formatDateId, formatRupiah, formatWeight } from '#lib/format';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { KatalogData } from './+page.server';

	let { data }: { data: KatalogData } = $props();
</script>

<svelte:head>
	<title>Katalog — KURMAPLUS</title>
	<meta name="description" content="Tiga kurma pilihan: sukari, ajwa, dan tunisia. Lihat harga dan ukuran." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<section class="intro">
		<h1>Kurma pilihan, dikirim akhir pekan</h1>
		<p class="muted">
			Sukari, ajwa, dan tunisia — dijual per ukuran dengan harga yang sama untuk semua pembeli.
		</p>
		<div class="info-box">
			<strong>Pengiriman terdekat:</strong>
			{#each data.deliveryDates as option, index (option.date)}
				{index > 0 ? ' dan ' : ' '}
				{option.weekdayName}, {formatDateId(option.date)}
			{#if option.isFull}<span class="badge badge-off">Penuh</span>{/if}
			{/each}
			<br />
			Kurir Grab atau Gojek, ongkir dibayar pemesan di luar total pesanan.
		</div>
	</section>

	<ul class="product-list">
		{#each data.products as product (product.id)}
			<li>
				<article class="product-card">
					<a class="product-photo" href={`/kurma/${product.slug}`}>
						<img
							src={`/images/${product.photo}`}
							alt={`Foto ${product.name}`}
							width="430"
							height="300"
							loading="lazy"
						/>
					</a>
					<div class="product-body">
						<h2><a href={`/kurma/${product.slug}`}>{product.name}</a></h2>
						{#if product.allOutOfStock}
							<p class="badge badge-off">Habis</p>
						{:else}
							<p class="price tabular">
								Mulai {formatRupiah(product.minPriceIdr)}
								<span class="muted">
									· {product.variants.map((variant) => formatWeight(variant.weightGrams)).join(' / ')}
								</span>
							</p>
						{/if}
						<a class="btn" href={`/kurma/${product.slug}`}>Lihat ukuran</a>
					</div>
				</article>
			</li>
		{/each}
	</ul>
</main>

<PageFooter />

<style>
	.intro {
		padding: 1.25rem 0 0.5rem;
	}

	.intro .info-box {
		margin-top: 0.75rem;
	}

	.product-list {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		display: grid;
		gap: 1.5rem;
	}

	.product-card {
		background: var(--card);
		border: 1px solid var(--sand);
		border-radius: var(--radius-l);
		overflow: hidden;
	}

	.product-photo img {
		width: 100%;
		aspect-ratio: 43 / 30;
		object-fit: cover;
	}

	.product-body {
		padding: 1rem 1.125rem 1.125rem;
	}

	.product-body h2 {
		margin-bottom: 0.25rem;
	}

	.product-body h2 a {
		color: var(--ink);
		text-decoration: none;
	}

	.price {
		margin: 0 0 0.875rem;
		font-weight: 700;
		color: var(--rust);
	}
</style>
