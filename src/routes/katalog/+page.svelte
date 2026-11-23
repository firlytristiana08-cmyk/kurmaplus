<script lang="ts">
	import { photoSrcset } from '#lib/photos';
	import { formatRupiah } from '#lib/format';
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
		<h1>Kurma enak untuk tiap hari — dikirim tiap akhir pekan.</h1>
	</section>

	<ul class="product-list">
		{#each data.products as product (product.id)}
			<li>
				<a class="product-card" href={`/kurma/${product.slug}`}>
					<div class="product-photo">
						{#if product.photos[0]}
							<img
								src={product.photos[0].src}
								srcset={photoSrcset(product.photos[0].id)}
								sizes="(max-width: 640px) 45vw, 230px"
								alt={`Foto ${product.name}`}
								width="430"
								height="430"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<div class="photo-placeholder" role="img" aria-label="Foto belum tersedia">
								<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true">
									<path d="M7.3 8.7v-.4a4.7 4.7 0 0 1 9.4 0v.4h-2.3v-.4a2.4 2.4 0 0 0-4.8 0v.4H7.3Z" />
									<rect x="4.5" y="8" width="15" height="13.7" rx="2.7" />
								</svg>
							</div>
						{/if}
						{#if product.bestSeller}
							<span class="best-badge">Best seller</span>
						{/if}
					</div>
					<div class="product-body">
						<h2>{product.name}</h2>
						{#if product.allOutOfStock}
							<p class="badge badge-off">Habis</p>
						{:else}
							<p class="price tabular">Mulai {formatRupiah(product.minPriceIdr)}</p>
						{/if}
						{#if product.sold > 0}
							<p class="sold">Terjual {product.sold}</p>
						{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>
</main>

<PageFooter />

<style>
	/* Kotak "Pengiriman terdekat" dihapus atas permintaan pemilik: jadwal
	   kirim sudah tampil di checkout (pilihan tanggal) dan di halaman Cara
	   pesan, jadi di sini hanya mengulang dan mendorong produk ke bawah. */
	.intro {
		padding: 1.25rem 0 0.25rem;
	}

	.product-list {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.product-card {
		display: block;
		height: 100%;
		background: var(--card);
		border: 1px solid var(--sand);
		border-radius: var(--radius-l);
		overflow: hidden;
		color: var(--ink);
		text-decoration: none;
	}

	.product-card:hover {
		border-color: var(--rust);
	}

	.product-card:focus-visible {
		outline: 2px solid var(--rust);
		outline-offset: 2px;
	}

	.product-photo {
		position: relative;
	}

	.photo-placeholder {
		width: 100%;
		aspect-ratio: 1 / 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f2eadb;
		background: color-mix(in srgb, var(--sand) 55%, var(--card));
		border-radius: 0;
		/* Ikon "foto belum tersedia" adalah satu-satunya isi kotak ini, jadi
		   ia grafis bermakna: wajib ≥ 3:1 terhadap latarnya. 35% hanya 2,10:1. */
		color: var(--redup-lemah);
	}

	.product-photo img {
		width: 100%;
		height: auto;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		display: block;
		/* Sudut dibulatkan oleh .product-card (overflow: hidden), bukan di sini.
		   Sebelumnya gambar dan placeholder memakai campuran radius berbeda. */
		border-radius: 0;
	}

	.best-badge {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		background: var(--rust);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.1875rem 0.5rem;
		border-radius: 999px;
	}

	.product-body {
		padding: 0.625rem 0.75rem 0.875rem;
	}

	.product-body h2 {
		font-size: 1rem;
		margin: 0 0 0.125rem;
	}

	.price {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--rust);
	}

	.sold {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--redup);
	}

	.product-body .badge {
		display: inline-block;
		margin: 0;
	}
</style>
