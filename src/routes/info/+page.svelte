<script lang="ts">
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>Cara pesan — KURMAPLUS</title>
	<meta name="description" content="Cara pesan, jadwal kirim, ongkir, dan kontak KURMAPLUS." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<h1>Cara pesan</h1>

	<section class="surface">
		<h2>Langkahnya</h2>
		<ol class="steps">
			<li>Pilih kurma dan ukuran yang Anda mau, lalu masukkan ke keranjang.</li>
			<li>Isi nama, nomor WhatsApp, alamat, dan pasang titik tujuan di peta.</li>
			<li>Pilih kurir Grab atau Gojek serta tanggal kirim Sabtu atau Minggu.</li>
			<li>Bayar lewat halaman DOKU — bisa virtual account, QRIS, atau minimarket.</li>
			<li>Pesanan tampil di halaman status dan bisa dilacak kapan saja.</li>
		</ol>
	</section>

	<section class="surface">
		<h2>Jadwal kirim</h2>
		<p>
			Pengiriman hanya hari <strong>Sabtu dan Minggu</strong> untuk area Jabodetabek. Pesanan yang
			masuk sebelum <strong>Kamis 23.59</strong> dikirim di akhir pekan yang sama; setelah itu masuk
			akhir pekan berikutnya. Setiap tanggal kirim punya batas jumlah pesanan.
		</p>
	</section>

	<section class="surface">
		<h2>Ongkir</h2>
		<p>
			Pengiriman memakai Grab atau Gojek. <strong>Ongkir dibayar pemesan</strong> kepada kurir saat
			barang datang, dan tidak termasuk dalam total pesanan di halaman bayar. Toko tidak menghitung
			atau menampilkan tarif ongkir karena tarif ditentukan aplikasi kurir.
		</p>
	</section>

	<section class="surface">
		<h2>Kontak</h2>
		<p>
			Ada pertanyaan atau ingin mengubah pesanan setelah bayar? Chat pemilik lewat tombol WhatsApp
			yang ada di halaman pesanan Anda.
		</p>
	</section>
</main>

<PageFooter />

<style>
	.surface {
		margin-bottom: 1rem;
	}

	.steps {
		margin: 0;
		padding-left: 1.25rem;
	}

	.steps li {
		margin-bottom: 0.5rem;
	}
</style>
