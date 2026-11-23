<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	// Log audit — "daftar bisa disaring per jenis dan tanggal, tidak ada tombol
	// ubah atau hapus" (AD-22).
	import { formatDateTimeId } from '#lib/format';

	let { data } = $props();
	const filter = $derived(data.filter);

	const actionLabels: Record<string, string> = {
		status_changed: 'Status diubah',
		order_cancelled: 'Pesanan dibatalkan',
		order_expired: 'Kedaluwarsa (sistem)',
		manual_paid: 'Bayar manual',
		shipping_updated: 'Ongkir diperbarui',
		delivery_moved: 'Tanggal dipindah',
		internal_note_saved: 'Catatan internal',
		refund_noted: 'Pengembalian dana',
		stock_adjusted: 'Stok disesuaikan',
		variant_updated: 'Varian diubah',
		product_updated: 'Produk diubah',
		settings_updated: 'Pengaturan diubah',
		orders_exported: 'Ekspor CSV',
	};

	function pageUrl(patch: Record<string, string | null>): string {
		const params = new URLSearchParams();
		const current: Record<string, string | null> = {
			objek: filter.entity ?? null,
			aksi: filter.action ?? null,
			from: filter.from ?? null,
			to: filter.to ?? null,
		};
		for (const [key, value] of Object.entries({ ...current, ...patch })) {
			if (value !== null && value !== '') params.set(key, value);
		}
		const qs = params.toString();
		return qs === '' ? '/admin/log' : `/admin/log?${qs}`;
	}
</script>

<svelte:head>
	<title>Log audit · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/lainnya" />

<main class="wrap">
	<header class="admin-head">
		<h1>Log audit</h1>
		<p class="muted page-sub">
			Siapapun mengubah apa dan kapan. Hanya-tambah — tidak bisa diubah atau dihapus (BA-12).
		</p>
	</header>

	<div class="chip-row">
		<a class="chip" class:is-active={!filter.entity} href={pageUrl({ objek: null })}>Semua</a>
		<a class="chip" class:is-active={filter.entity === 'order'} href={pageUrl({ objek: 'order' })}>Pesanan</a>
		<a class="chip" class:is-active={filter.entity === 'variant'} href={pageUrl({ objek: 'variant' })}>Varian</a>
		<a class="chip" class:is-active={filter.entity === 'settings'} href={pageUrl({ objek: 'settings' })}>Pengaturan</a>
		<a class="chip" class:is-active={filter.entity === 'export'} href={pageUrl({ objek: 'export' })}>Ekspor</a>
	</div>
	<form class="filter-bar" method="GET" action="/admin/log">
		<label class="chip chip-static" for="dari">
			Dari
			<input id="dari" name="from" type="date" value={filter.from ?? ''} />
		</label>
		<label class="chip chip-static" for="sampai">
			Sampai
			<input id="sampai" name="to" type="date" value={filter.to ?? ''} />
		</label>
		<button class="btn-mini" type="submit">Terapkan</button>
	</form>

	<div class="surface">
		{#if data.entries.length === 0}
			<p class="muted">Belum ada catatan pada saringan ini.</p>
		{:else}
			<ul class="timeline">
				{#each data.entries as entry (entry.id)}
					<li>
						<span class="when">{formatDateTimeId(entry.createdAt)} · {entry.actor}</span>
						<strong>{actionLabels[entry.action] ?? entry.action}</strong> — {entry.entity}
						{entry.entityId}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>

<div class="page-foot-space"></div>
