<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	// Laporan sederhana: angka dalam tabel, tanpa grafik (PRD — laporan versi 1).
	import { enhance } from '$app/forms';
	import { STATUS_LABEL_ID } from '#lib/order-status';
	import { formatRupiah } from '#lib/format';

	let { data } = $props();
	const report = $derived(data.report);

	/** Pintasan periode: pertanyaan tersering tanpa mengetik dua tanggal. */
	function shortcut(kind: '7' | '30' | 'bulan' | 'semua'): string {
		const hariIni = new Date();
		const iso = (d: Date): string => d.toISOString().slice(0, 10);
		const akhir = iso(hariIni);
		if (kind === 'semua') return '/admin/laporan?from=2020-01-01&to=' + akhir;
		if (kind === 'bulan') {
			const awal = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
			return `/admin/laporan?from=${iso(awal)}&to=${akhir}`;
		}
		const mulai = new Date(hariIni);
		mulai.setDate(mulai.getDate() - Number(kind) + 1);
		return `/admin/laporan?from=${iso(mulai)}&to=${akhir}`;
	}
</script>

<svelte:head>
	<title>Laporan · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/lainnya" />

<main class="wrap">
	<header class="admin-head">
		<h1>Laporan</h1>
		<p class="muted page-sub">
			{report.from} sampai {report.to} · omzet dihitung dari pesanan dibayar sampai selesai,
			tanpa ongkir (BA-06).
		</p>
	</header>

	<form class="filter-bar" method="GET" action="/admin/laporan">
		<label class="chip chip-static" for="dari">
			Dari
			<input id="dari" name="from" type="date" value={report.from} />
		</label>
		<label class="chip chip-static" for="sampai">
			Sampai
			<input id="sampai" name="to" type="date" value={report.to} />
		</label>
		<button class="btn-mini" type="submit">Terapkan</button>
	</form>

	<div class="chip-row">
		<a class="chip" href={shortcut('7')}>7 hari</a>
		<a class="chip" href={shortcut('30')}>30 hari</a>
		<a class="chip" href={shortcut('bulan')}>Bulan ini</a>
		<a class="chip" href={shortcut('semua')}>Semua</a>
	</div>

	<div class="surface">
		<h2 class="card-title">Ringkasan</h2>
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
		<h2 class="card-title">Penjualan per varian</h2>
		{#if report.perVariant.length === 0}
			<p class="muted">Belum ada penjualan pada periode ini.</p>
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
	<p class="muted is-center mt-s">
		UTF-8 + BOM — terbuka benar di Excel dan Google Sheets.
	</p>
</main>

<div class="page-foot-space"></div>
