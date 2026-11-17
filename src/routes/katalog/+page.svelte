<script lang="ts">
	import { formatRupiah } from '#lib/format';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { KatalogData } from './+page.server';

	let { data }: { data: KatalogData } = $props();

	const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

	// "Sabtu & Minggu, 21–22 Nov" — versi pendek tanggal kirim terdekat.
	function ringkasTanggal(options: { date: string; weekdayName: string }[]): string {
		if (options.length === 0) return '—';
		const parsed = options.map((option) => {
			const d = new Date(`${option.date}T00:00:00`);
			return {
				day: d.getDate(),
				month: d.getMonth(),
				year: d.getFullYear(),
				weekday: option.weekdayName
			};
		});
		const weekdays = parsed.map((d) => d.weekday).join(' & ');
		const sameMonth = parsed.every((d) => d.month === parsed[0].month && d.year === parsed[0].year);
		if (sameMonth) {
			const nums = parsed.map((d) => d.day);
			const berurutan = parsed.length === 2 && nums[1] === nums[0] + 1;
			const angka = berurutan ? `${nums[0]}–${nums[1]}` : nums.join(' & ');
			return `${weekdays}, ${angka} ${BULAN_PENDEK[parsed[0].month]}`;
		}
		return parsed.map((d) => `${d.weekday} ${d.day} ${BULAN_PENDEK[d.month]}`).join(' & ');
	}
</script>

<svelte:head>
	<title>Katalog — KURMAPLUS</title>
	<meta name="description" content="Tiga kurma pilihan: sukari, ajwa, dan tunisia. Lihat harga dan ukuran." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<section class="intro">
		<h1>Kurma enak untuk tiap hari — dikirim tiap akhir pekan.</h1>
		<div class="info-box">
			<strong>Pengiriman terdekat:</strong>
			{ringkasTanggal(data.deliveryDates)}
			{#if data.deliveryDates.some((option) => option.isFull)}
				<span class="badge badge-off">Sebagian penuh</span>
			{/if}
			<br />
			Ongkir Grab/Gojek — dibayar langsung ke kurir.
		</div>
	</section>

	<ul class="product-list">
		{#each data.products as product (product.id)}
			<li>
				<a class="product-card" href={`/kurma/${product.slug}`}>
					<div class="product-photo">
						<img
							src={`/images/${product.photo}`}
							alt={`Foto ${product.name}`}
							width="430"
							height="430"
							loading="lazy"
						/>
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

	.product-photo img {
		width: 100%;
		height: auto;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		display: block;
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
		color: color-mix(in srgb, var(--ink) 62%, var(--card));
	}

	.product-body .badge {
		display: inline-block;
		margin: 0;
	}
</style>
