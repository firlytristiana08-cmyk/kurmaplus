<script lang="ts">
	// Produk — daftar ringkas (tugas 116). Ketuk produk untuk membuka halaman
	// ubah detail/foto/varian; produk baru lewat halaman Tambah produk.
	import { formatDateTimeId, formatRupiah } from '#lib/format';

	let { data } = $props();

	const reasonLabels: Record<string, string> = {
		lock_order: 'Terkunci pesanan',
		expire_return: 'Kembali (kedaluwarsa)',
		cancel_return: 'Kembali (dibatalkan)',
		adjustment: 'Penyesuaian manual',
		stock_initial: 'Stok awal varian baru',
	};

	let products = $derived.by(() => {
		const photosByProduct = new Map<number, string>();
		for (const photo of data.photos) {
			if (!photosByProduct.has(photo.product_id)) {
				photosByProduct.set(photo.product_id, `/api/foto/${photo.id}`);
			}
		}
		return data.products.map((product) => ({
			...product,
			photo: photosByProduct.get(product.id) ?? null,
			variants: data.variants.filter((variant) => variant.product_id === product.id),
		}));
	});
</script>

<svelte:head>
	<title>Produk · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<h1>Produk</h1>
		<p class="muted page-sub">
			Daftar produk beserta varian dan stoknya. Ketuk produk untuk mengubah detail, foto, dan
			variannya.
		</p>
	</header>

	<div class="section-head">
		<h2>Daftar produk</h2>
		<a class="btn-mini is-rust" href="/admin/produk/tambah">Tambah produk</a>
	</div>

	{#each products as product (product.id)}
		<a class="surface product-line" href={`/admin/produk/${product.id}`}>
			{#if product.photo}
				<img class="photo-thumb" src={product.photo} alt="" />
			{/if}
			<div class="row-main">
				<div class="row-l1">
					{product.name}
					{#if product.is_best_seller}<span class="badge badge-alert">Best seller</span>{/if}
					{#if !product.is_active}<span class="badge badge-off">Nonaktif</span>{/if}
				</div>
				<div class="row-l2 tabular">
					{#each product.variants as variant (variant.id)}
						{variant.label} · {formatRupiah(variant.price_idr)} · stok {variant.stock}
						{#if variant.stock < data.threshold}<span class="badge badge-alert">Stok menipis</span>{/if}
						{#if !variant.is_active}<span class="badge badge-off">Nonaktif</span>{/if}
						<br />
					{/each}
				</div>
			</div>
			<div class="row-side" aria-hidden="true">›</div>
		</a>
	{/each}

	<div class="section-head">
		<h2>Riwayat stok</h2>
	</div>
	<div class="surface">
		{#if data.movements.length === 0}
			<p class="muted" style="margin: 0">Belum ada pergerakan stok.</p>
		{:else}
			<ul class="timeline">
				{#each data.movements as mv (mv.id)}
					<li>
						<span class="when">{formatDateTimeId(mv.created_at)} · {mv.actor}</span>
						Varian #{mv.variant_id} · {mv.delta > 0 ? `+${mv.delta}` : mv.delta} —
						{reasonLabels[mv.reason] ?? mv.reason}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>

<div class="page-foot-space"></div>
