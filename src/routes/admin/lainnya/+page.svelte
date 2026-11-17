<script lang="ts">

	let { data } = $props();
</script>

<svelte:head>
	<title>Lainnya · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<p class="wordmark">KURMAPLUS <span class="plus">Admin</span></p>
		<h1>Lainnya</h1>
		<p class="muted page-sub">Masuk sebagai {data.session.label}.</p>
	</header>

	<div class="surface">
		<a class="row" href="/admin/pengaturan">
			<div class="row-main">
				<div class="row-l1">Pengaturan toko</div>
				<div class="row-l2">Buka/tutup, tanggal libur, batas pesan, WhatsApp, templat pesan</div>
			</div>
			<div class="row-side" aria-hidden="true">›</div>
		</a>
		<a class="row" href="/admin/laporan">
			<div class="row-main">
				<div class="row-l1">Laporan</div>
				<div class="row-l2">Jumlah pesanan, omzet, produk terlaris, ekspor CSV</div>
			</div>
			<div class="row-side" aria-hidden="true">›</div>
		</a>
		<a class="row" href="/admin/log">
			<div class="row-main">
				<div class="row-l1">Log audit</div>
				<div class="row-l2">Siapa mengubah apa dan kapan — hanya bisa dibaca</div>
			</div>
			<div class="row-side" aria-hidden="true">›</div>
		</a>
		<a class="row" href="/">
			<div class="row-main">
				<div class="row-l1">Buka portal pelanggan</div>
				<div class="row-l2">Tampilan yang dilihat pembeli</div>
			</div>
			<div class="row-side" aria-hidden="true">›</div>
		</a>
	</div>

	<form method="POST" action="/admin/masuk?/keluar">
		<button class="btn btn-secondary" type="submit">Keluar</button>
	</form>
</main>

<div class="page-foot-space"></div>
