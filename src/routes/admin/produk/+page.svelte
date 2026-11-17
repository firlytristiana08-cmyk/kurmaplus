<script lang="ts">
	// Produk dan stok — "tabel di HP menjadi daftar baris" (PRD — Arah desain).
	// Penyesuaian stok selalu bercatatan (BA-08); perubahan harga hanya untuk
	// pesanan baru (BA-09).
	import { enhance } from '$app/forms';
	import { formatDateTimeId, formatRupiah } from '#lib/format';

	let { data, form } = $props();

	const reasonLabels: Record<string, string> = {
		lock_order: 'Terkunci pesanan',
		expire_return: 'Kembali (kedaluwarsa)',
		cancel_return: 'Kembali (dibatalkan)',
		adjustment: 'Penyesuaian manual',
	};

	let products = $derived.by(() => {
		const map = new Map<
			number,
			{ id: number; name: string; active: number; variants: (typeof data.variants)[number][] }
		>();
		for (const row of data.variants) {
			let entry = map.get(row.product_id);
			if (!entry) {
				entry = { id: row.product_id, name: row.product_name, active: row.product_active, variants: [] };
				map.set(row.product_id, entry);
			}
			entry.variants.push(row);
		}
		return [...map.values()];
	});
</script>

<svelte:head>
	<title>Produk · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<h1>Produk &amp; stok</h1>
		<p class="muted page-sub">
			Harga baru hanya untuk pesanan baru (BA-09). Stok disesuaikan dengan alasan, tidak pernah
			negatif (BA-08).
		</p>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}

	{#each products as product (product.id)}
		<div class="section-head">
			<h2>{product.name}</h2>
			<form method="POST" action="?/produk" use:enhance>
				<input type="hidden" name="product_id" value={product.id} />
				<input type="hidden" name="active" value={product.active ? '0' : '1'} />
				<button class="btn-mini" type="submit">{product.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
			</form>
		</div>
		<div class="surface">
			{#each product.variants as variant (variant.id)}
				<div class="row" style="align-items: flex-start; flex-direction: column; gap: 0.5rem">
					<div class="row-l1" style="width: 100%">
						{variant.label}
						{#if !variant.is_active}<span class="badge badge-off">Nonaktif</span>{/if}
						{#if variant.stock < data.threshold}
							<span class="badge badge-alert">
								<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M0.5 0.5 11.5 11.5M11.5 0.5 0.5 11.5" stroke="currentColor" stroke-width="2.4" /></svg>
								Stok menipis
							</span>
						{/if}
						<span style="margin-left: auto" class="tabular">{formatRupiah(variant.price_idr)}</span>
					</div>
					<div class="row-l2 tabular">
						Stok tersedia {variant.stock} · terkunci {variant.locked}
					</div>
					<form method="POST" action="?/varian" use:enhance style="width: 100%">
						<input type="hidden" name="variant_id" value={variant.id} />
						<div class="btn-row" style="margin: 0.25rem 0 0.75rem">
							<input
								name="price"
								type="text"
								inputmode="numeric"
								value={variant.price_idr}
								aria-label="Harga {variant.label}"
								style="min-height: 44px; max-width: 8.5rem"
							/>
							<button class="btn-mini" type="submit">Simpan harga</button>
							<button class="btn-mini" type="submit" name="active" value={variant.is_active ? '0' : '1'}>
								{variant.is_active ? 'Nonaktifkan' : 'Aktifkan'}
							</button>
						</div>
					</form>
					<form
						method="POST"
						action="?/stok"
						use:enhance
						style="width: 100%"
						onsubmit={(event) => {
							const reason = event.currentTarget.querySelector<HTMLInputElement>('input[name="reason"]');
							if (!reason || reason.value.trim() === '') {
								event.preventDefault();
								window.alert('Alasan penyesuaian stok wajib diisi.');
							}
						}}
					>
						<input type="hidden" name="variant_id" value={variant.id} />
						<div class="btn-row" style="margin: 0">
							<input name="delta" type="number" step="1" value="0" aria-label="Selisih stok" style="min-height: 44px; max-width: 5.5rem" />
							<input name="reason" type="text" placeholder="Alasan (wajib)" aria-label="Alasan penyesuaian" style="min-height: 44px; flex: 1; min-width: 9rem" />
							<button class="btn-mini is-rust" type="submit">Sesuaikan stok</button>
						</div>
					</form>
				</div>
			{/each}
		</div>
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
