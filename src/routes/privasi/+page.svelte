<script lang="ts">
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>Privasi — KURMAPLUS</title>
	<meta
		name="description"
		content="Kebijakan privasi KURMAPLUS sesuai UU Pelindungan Data Pribadi."
	/>
</svelte:head>

<PageHeader />

<main class="wrap">
	<h1>Kebijakan privasi</h1>

	<section class="surface">
		<h2>Data yang kami ambil</h2>
		<p>
			Nama, nomor WhatsApp, alamat, catatan patokan, dan titik koordinat tujuan hanya dipakai untuk
			mengirim pesanan Anda. Data ini disimpan bersama rincian pesanan.
		</p>
	</section>

	<section class="surface">
		<h2>Cara kami memakainya</h2>
		<p>
			Data pengiriman dibagikan kepada kurir (Grab atau Gojek) yang Anda pilih dan kepada penyedia
			pembayaran DOKU sebatas yang dibutuhkan untuk memproses pembayaran. Kami tidak menjual data
			pribadi Anda.
		</p>
	</section>

	<section class="surface">
		<h2>Keamanan dan masa simpan</h2>
		<p>
			Halaman lacak hanya menemukan pesanan Anda dengan kode pesanan dan 4 digit terakhir nomor
			WhatsApp. Halaman status tidak pernah menampilkan alamat lengkap. Data pesanan lama akan
			dianonimkan setelah masa simpan yang ditentukan pemilik toko.
		</p>
	</section>

	<section class="surface">
		<h2>Hak Anda</h2>
		<p>
			Sesuai UU Pelindungan Data Pribadi, Anda berhak meminta akses atau penghapusan data pribadi
			yang kami simpan. Sampaikan permintaan lewat chat WhatsApp di halaman pesanan Anda.
		</p>
	</section>
</main>

<PageFooter />

<style>
	.surface {
		margin-bottom: 1rem;
	}
</style>
