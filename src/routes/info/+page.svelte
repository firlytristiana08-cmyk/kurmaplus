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
			<li>
				Pilih kurma dan ukuran, lalu tekan <strong>Keranjang</strong> untuk mengumpulkan beberapa
				item, atau <strong>Beli langsung</strong> untuk langsung bayar item itu saja.
			</li>
			<li>Isi nama, nomor WhatsApp, alamat, dan pasang titik tujuan di peta.</li>
			<li>Pilih pengiriman COD, Grab, atau Gojek, lalu tanggal kirim Sabtu atau Minggu.</li>
			<li>
				Bayar dengan QRIS lewat halaman DOKU. Ada batas waktu bayar sejak pesanan dibuat.
			</li>
			<li>Pantau pesanan dari halaman pesanan Anda atau menu Lacak pesanan.</li>
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
			Pengiriman memakai COD, Grab, atau Gojek. Ongkir mengikuti tarif pengiriman dan dibayar
			langsung saat barang datang — tidak termasuk total di halaman bayar.
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
