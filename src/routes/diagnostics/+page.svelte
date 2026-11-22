<script lang="ts">
	// TODO(hapus): halaman diagnosis sementara — hapus setelah integrasi DOKU stabil.
	import '../admin/admin.css';

	let { data } = $props();
</script>

<svelte:head>
	<title>Diagnostik Integrasi · KURMAPLUS</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<p class="wordmark">KURMAPLUS <span class="plus">Diagnostik</span></p>
		<h1>Diagnostik integrasi</h1>
		<p class="muted page-sub">Halaman sementara untuk memeriksa kesiapan pembayaran DOKU.</p>
	</header>

	<p class={data.needsAction ? 'error-box' : 'info-box'}>
		{data.needsAction
			? 'Ada pemeriksaan yang belum lulus — lihat baris berikut.'
			: 'Semua pemeriksaan lulus. Tidak ada tindakan yang diperlukan dari Anda.'}
	</p>

	{#each data.checks as check (check.name)}
		<div class={check.ok ? 'info-box' : 'error-box'}>
			<strong>{check.name} — {check.ok ? 'LULUS' : 'GAGAL'}</strong>
			<p style="margin: 0.25rem 0 0">{check.detail}</p>
			{#if check.action}
				<p style="margin: 0.375rem 0 0"><strong>Tindakan:</strong> {check.action}</p>
			{/if}
		</div>
	{/each}

	<h2 style="margin: 1.5rem 0 0.5rem">Jalur koneksi database (uji terpisah)</h2>
	<p class="muted" style="margin: 0 0 0.75rem">
		Setiap jalur diuji sendiri-sendiri — perbandingan hasilnya menunjukkan persis di mana koneksi
		terputus.
	</p>
	{#each data.probes as probe (probe.name)}
		<div class={probe.ok ? 'info-box' : 'error-box'}>
			<strong>{probe.name} — {probe.ok ? 'LULUS' : 'GAGAL'}</strong>
			<p style="margin: 0.25rem 0 0"><code>{probe.target}</code></p>
			<p style="margin: 0.25rem 0 0">{probe.detail}</p>
		</div>
	{/each}

	<div class="surface">
		<p class="muted" style="margin: 0">
			Info: URL notifikasi yang didaftarkan di dashboard DOKU sandbox harus
			<code>https://kurmaplus.workers.dev/api/webhook/doku</code>.
		</p>
	</div>
</main>

<div class="page-foot-space"></div>
