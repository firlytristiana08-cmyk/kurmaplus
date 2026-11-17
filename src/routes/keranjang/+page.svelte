<script lang="ts">
	import { formatRupiah, formatWeight } from '#lib/format';
	import { cart, clearDirectBuy, type CartItem } from '#lib/cart.svelte';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { CartData } from './+page.server';

	let { data }: { data: CartData } = $props();

	$effect(() => {
		cart.hydrate();
		// Halaman keranjang = alur keranjang: buang sisa mode beli langsung.
		clearDirectBuy();
	});

	interface CartRow {
		item: CartItem;
		name: string;
		label: string;
		weightGrams: number;
		priceIdr: number;
		stock: number;
		photo: string | null;
		slug: string;
	}

	const rows = $derived.by((): CartRow[] => {
		const found: CartRow[] = [];
		for (const item of cart.items) {
			for (const product of data.products) {
				const variant = product.variants.find((candidate) => candidate.id === item.variantId);
				if (variant) {
					found.push({
						item,
						name: product.name,
						label: variant.label,
						weightGrams: variant.weightGrams,
						priceIdr: variant.priceIdr,
						stock: variant.stock,
						photo: product.photo,
						slug: product.slug
					});
				}
			}
		}
		return found;
	});

	const subtotal = $derived(rows.reduce((sum, row) => sum + row.priceIdr * row.item.qty, 0));
</script>

<svelte:head>
	<title>Keranjang — KURMAPLUS</title>
	<meta name="description" content="Periksa barang belanjaan Anda sebelum checkout." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<h1>Keranjang</h1>

	{#if rows.length === 0}
		<p class="muted">Keranjang masih kosong.</p>
		<a class="btn" href="/katalog">Pilih kurma</a>
	{:else}
		<ul class="cart-list">
			{#each rows as row (row.item.variantId)}
				<li class="cart-row">
					<img
						class="thumb"
						src={`/images/${row.photo}`}
						alt=""
						width="72"
						height="72"
						loading="lazy"
					/>
					<div class="cart-info">
						<div class="row-head">
							<p class="name">{row.name}</p>
							<p class="line-total tabular">{formatRupiah(row.priceIdr * row.item.qty)}</p>
						</div>
						<p class="unit muted tabular">
							{formatWeight(row.weightGrams)} · {row.item.qty} × {formatRupiah(row.priceIdr)}
						</p>
						{#if row.stock < row.item.qty}
							<p class="error-text">Stok tinggal {row.stock}, kurangi jumlahnya.</p>
						{/if}
						<div class="row-actions">
							<div class="qty-stepper" role="group" aria-label={`Jumlah ${row.name} ${row.label}`}>
								<button
									type="button"
									class="qty-btn"
									aria-label="Kurangi jumlah"
									onclick={() => cart.setQty(row.item.variantId, row.item.qty - 1)}>−</button
								>
								<span class="qty-value tabular">{row.item.qty}</span>
								<button
									type="button"
									class="qty-btn"
									aria-label="Tambah jumlah"
									disabled={row.item.qty >= Math.min(99, row.stock)}
									onclick={() => cart.setQty(row.item.variantId, row.item.qty + 1)}>+</button
								>
							</div>
							<button
								type="button"
								class="remove-btn"
								onclick={() => cart.remove(row.item.variantId)}>Hapus</button
							>
						</div>
					</div>
				</li>
			{/each}
		</ul>

		<div class="subtotal-row">
			<span>Subtotal</span>
			<strong class="tabular">{formatRupiah(subtotal)}</strong>
		</div>
	{/if}
</main>

<!-- Bilah tombol di luar .wrap agar lebarnya rata kiri-kanan seperti halaman lain. -->
{#if rows.length > 0}
	<div class="sticky-bar">
		<div class="sticky-inner">
			<a class="btn" href="/checkout">Lanjut ke checkout</a>
		</div>
	</div>
{/if}

<PageFooter />

<style>
	.cart-list {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
	}

	/* Dua kolom + total di baris sendiri. Lebar konten dibatasi 430 px
	   (.wrap), sedangkan deret tombol sentuh 48 px dan nominal tidak bisa
	   dipaksa mengecil — susunan tiga kolom membuat layar HP bergeser
	   ke kanan-kiri. */
	.cart-row {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		column-gap: 0.75rem;
		row-gap: 0.375rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--sand);
	}

	.thumb {
		width: 72px;
		height: 72px;
		object-fit: cover;
		border-radius: var(--radius-s);
	}

	.cart-info {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	/* Nama dan total satu baris — mata langsung menghubungkan produk dengan
	   harganya, dan kolom nominal sejajar lurus ke bawah antar-baris. */
	.row-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.name {
		flex: 1 1 auto;
		min-width: 0;
		font-weight: 700;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.unit {
		margin: 0;
		white-space: nowrap;
	}

	.row-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.qty-stepper {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.qty-btn {
		width: 48px;
		height: 48px;
		border: 1.5px solid var(--sand);
		border-radius: var(--radius-s);
		background: var(--card);
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--ink);
		cursor: pointer;
	}

	.qty-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.qty-value {
		min-width: 2rem;
		text-align: center;
		font-weight: 700;
	}

	.remove-btn {
		min-height: 48px;
		padding: 0 0.5rem;
		border: none;
		background: none;
		color: var(--brick);
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		text-decoration: underline;
	}

	/* Angka tabular + lebar minimum tetap: nominal tidak bergeser kiri-kanan
	   saat jumlah ditekan, dan tepi kanan selalu sejajar dengan Subtotal. */
	.line-total {
		flex: 0 0 auto;
		min-width: 7.5rem;
		text-align: right;
		font-weight: 700;
		white-space: nowrap;
	}

	.subtotal-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 1rem 0 0.25rem;
		font-size: 1.0625rem;
	}
</style>
