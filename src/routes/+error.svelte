<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Halaman tidak ditemukan — KURMAPLUS</title>
</svelte:head>

<main class="wrap">
	<section class="error-card">
		<h1>{page.status === 404 ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'}</h1>
		<p class="muted">
			{page.status === 404
				? 'Alamat yang Anda buka tidak tersedia di toko ini.'
				: 'Coba muat ulang halaman beberapa saat lagi.'}
		</p>
		<a class="btn" href="/katalog">Ke katalog</a>
	</section>
</main>

<style>
	.error-card {
		padding: 3rem 0;
	}
</style>
