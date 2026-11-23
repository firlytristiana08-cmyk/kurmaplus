<script lang="ts">
	// Daftar pesanan — baris dua tingkat, filter lewat URL (AD-05).
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { STATUS_LABEL_ID, type OrderStatus } from '#lib/order-status';
	import { formatDateId, formatDateTimeId, formatRupiah } from '#lib/format';

	let { data } = $props();
	const list = $derived(data.list);
	const filter = $derived(data.filter);

	const statuses = Object.keys(STATUS_LABEL_ID) as OrderStatus[];

	function pageUrl(patch: Record<string, string | null>): string {
		const params = new URLSearchParams();
		const current: Record<string, string | null> = {
			status: filter.status ?? null,
			tanggal: filter.deliveryDate ?? null,
			kurir: filter.courier ?? null,
			ongkir: filter.shippingStatus ?? null,
			q: filter.q ?? null,
			hal: list.page > 1 ? String(list.page) : null,
		};
		for (const [key, value] of Object.entries({ ...current, ...patch })) {
			if (value !== null && value !== "") params.set(key, value);
		}
		const qs = params.toString();
		return qs === "" ? "/admin/pesanan" : `/admin/pesanan?${qs}`;
	}
</script>

<svelte:head>
	<title>Pesanan · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<h1>Pesanan</h1>
		<p class="muted page-sub">
			{list.total} pesanan cocok dengan saringan · terbaru di atas
		</p>
	</header>

	<form class="filters" method="GET" action="/admin/pesanan">
		<div class="field">
			<label for="q">Cari kode, nama, atau nomor WhatsApp</label>
			<input id="q" name="q" type="search" value={filter.q ?? ''} placeholder="mis. DEMO4455 atau Budi" />
		</div>
		<div class="chip-scroll">
			<a class="chip" class:is-active={!filter.status} href={pageUrl({ status: null, hal: null })}>Semua</a>
			{#each statuses as status (status)}
				<a class="chip" class:is-active={filter.status === status} href={pageUrl({ status, hal: null })}>
					{STATUS_LABEL_ID[status]}
				</a>
			{/each}
		</div>
		<div class="chip-scroll">
			<a class="chip" class:is-active={!filter.shippingStatus} href={pageUrl({ ongkir: null, hal: null })}>Ongkir: semua</a>
			<a class="chip" class:is-active={filter.shippingStatus === 'pending'} href={pageUrl({ ongkir: 'pending', hal: null })}>Belum dikonfirmasi</a>
			<a class="chip" class:is-active={filter.shippingStatus === 'paid'} href={pageUrl({ ongkir: 'paid', hal: null })}>Sudah dikonfirmasi</a>
		</div>
		<!-- Satu pola saringan untuk SEMUA halaman admin: ubah isian, lalu
		     tekan Terapkan. Dulu di sini isian mengirim form sendiri DAN ada
		     tombol Terapkan — dua mekanisme untuk hal yang sama. -->
		<div class="chip-row">
			<label class="chip chip-static" for="kurir">
				Pengiriman
				<select id="kurir" name="kurir">
					<option value="" selected={!filter.courier}>Semua</option>
					<option value="COD" selected={filter.courier === 'COD'}>COD</option>
					<option value="Grab" selected={filter.courier === 'Grab'}>Grab</option>
					<option value="Gojek" selected={filter.courier === 'Gojek'}>Gojek</option>
				</select>
			</label>
			<label class="chip chip-static" for="tanggal">
				Tanggal kirim
				<input id="tanggal" name="tanggal" type="date" value={filter.deliveryDate ?? ''} />
			</label>
			<button class="btn-mini" type="submit">Terapkan</button>
		</div>
	</form>

	<div class="surface">
		{#if list.rows.length === 0}
			<p class="muted">Belum ada pesanan yang cocok dengan saringan ini.</p>
		{:else}
			{#each list.rows as order (order.code)}
				<a class="row" href={`/admin/pesanan/${order.code}`}>
					<div class="row-main">
						<div class="row-l1">
							{order.code} · {order.customerName}
							<StatusBadge status={order.status} />
							<span class="muted">{formatDateTimeId(order.createdAt)}</span>
						</div>
						<div class="row-l2 tabular">
							{formatDateId(order.deliveryDate)} · {order.city} · {order.courier} ·
							{formatRupiah(order.totalIdr)} · ongkir
							{order.shippingStatus === 'paid' ? 'dikonfirmasi' : 'belum dikonfirmasi'}
						</div>
					</div>
					<div class="row-side" aria-hidden="true">›</div>
				</a>
			{/each}
		{/if}
	</div>

	{#if list.pages > 1}
		<div class="chip-row is-center">
			{#if list.page > 1}
				<a class="chip" href={pageUrl({ hal: String(list.page - 1) })}>‹ Sebelumnya</a>
			{/if}
			<span class="chip chip-static">Hal {list.page}/{list.pages}</span>
			{#if list.page < list.pages}
				<a class="chip" href={pageUrl({ hal: String(list.page + 1) })}>Berikutnya ›</a>
			{/if}
		</div>
	{/if}
</main>

<div class="page-foot-space"></div>
