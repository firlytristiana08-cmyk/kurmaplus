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

	<div class="surface">
		<p class="muted" style="margin: 0">
			Info: URL notifikasi yang didaftarkan di dashboard DOKU sandbox harus
			<code>https://kurmaplus.vercel.app/api/webhook/doku</code>.
		</p>
	</div>
</main>

<div class="page-foot-space"></div>
