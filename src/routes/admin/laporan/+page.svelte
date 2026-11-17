<script lang="ts">
	// Laporan sederhana: angka dalam tabel, tanpa grafik (PRD — laporan versi 1).
	import { enhance } from '$app/forms';
	import { STATUS_LABEL_ID } from '#lib/order-status';
	import { formatRupiah } from '#lib/format';

	let { data } = $props();
	const report = $derived(data.report);
</script>

<svelte:head>
	<title>Laporan · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<h1>Laporan</h1>
		<p class="muted page-sub">
			{report.from} sampai {report.to} · omzet dihitung dari pesanan dibayar sampai selesai,
			tanpa ongkir (BA-06).
		</p>
	</header>

	<form class="chip-row" method="GET" action="/admin/laporan">
		<label class="chip" style="cursor: default">
			Dari
			<input name="from" type="date" value={report.from} style="min-height: 32px; border: none; background: transparent; font-weight: 700" />
		</label>
		<label class="chip" style="cursor: default">
			Sampai
			<input name="to" type="date" value={report.to} style="min-height: 32px; border: none; background: transparent; font-weight: 700" />
		</label>
		<button class="btn-mini" type="submit">Terapkan</button>
	</form>

	<div class="surface">
		<h3 style="margin-top: 0">Ringkasan</h3>
		<div class="recap-line">
			<span class="day">Jumlah pesanan</span>
			<span class="sum tabular">{report.orderCount}</span>
		</div>
		<div class="recap-line">
			<span class="day">Omzet (tanpa ongkir)</span>
			<span class="sum tabular">{formatRupiah(report.omzetIdr)}</span>
		</div>
		{#each report.statusCounts as row (row.status)}
			<div class="recap-line">
				<span class="day">{STATUS_LABEL_ID[row.status]}</span>
				<span class="sum tabular">{row.n}</span>
			</div>
		{/each}
	</div>

	<div class="surface">
		<h3 style="margin-top: 0">Penjualan per varian</h3>
		{#if report.perVariant.length === 0}
			<p class="muted" style="margin: 0">Belum ada penjualan pada periode ini.</p>
		{:else}
			{#each report.perVariant as row (row.name)}
				<div class="recap-line">
					<span class="day">{row.name}</span>
					<span class="sum tabular">{row.qty} terjual · {formatRupiah(row.revenueIdr)}</span>
				</div>
			{/each}
		{/if}
	</div>

	<a
		class="btn"
		href={`/admin/laporan/csv?from=${report.from}&to=${report.to}`}
		onclick={(event) => {
			if (!window.confirm('Ekspor CSV memuat data pribadi pembeli. Simpan berkas dengan aman. Ekspor tercatat di log audit.')) {
				event.preventDefault();
			}
		}}
	>
		Ekspor CSV pesanan periode ini
	</a>
	<p class="muted" style="text-align: center; margin: 0.5rem 0 0">
		UTF-8 + BOM — terbuka benar di Excel dan Google Sheets.
	</p>
</main>

<div class="page-foot-space"></div>
