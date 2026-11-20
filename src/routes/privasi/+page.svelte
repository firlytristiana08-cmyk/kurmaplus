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
			Nama, nomor WhatsApp, email, alamat, catatan patokan, dan titik koordinat tujuan dipakai untuk
			mengirim pesanan Anda dan disimpan bersama rincian pesanan. Keranjang belanja hanya
			tersimpan di perangkat Anda, bukan di server kami.
		</p>
	</section>

	<section class="surface">
		<h2>Cara kami memakainya</h2>
		<p>
			Data pengiriman dibagikan kepada penyedia pengiriman (COD, Grab, atau Gojek) yang Anda pilih, dan data
			pembayaran diproses penyedia pembayaran DOKU. Kami memakai nomor WhatsApp Anda untuk
			konfirmasi pengiriman dan membantu melacak pesanan. Kami tidak menjual data pribadi Anda.
		</p>
	</section>

	<section class="surface">
		<h2>Akses ke pesanan Anda</h2>
		<p>
			Lacak pesanan hanya menemukan pesanan dengan kode pesanan (No invoice) dan 4 digit terakhir nomor
			WhatsApp. Halaman pesanan memuat rincian pengiriman lengkap, jadi jangan bagikan tautan
			pesanan Anda ke sembarang orang.
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
