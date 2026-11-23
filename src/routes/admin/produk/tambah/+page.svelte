<script lang="ts">
	// Tambah produk (tugas 116): nama, deskripsi, foto (satu kolom unggah,
	// boleh banyak), dan varian yang dijual.
	import { enhance } from '$app/forms';
	import BackLink from '#lib/components/BackLink.svelte';
	import { adminEnhance } from '#lib/admin-feedback';
	import PhotoPicker from '#lib/components/admin/PhotoPicker.svelte';
	import type { PhotoTiers } from '#lib/photos';

	let { form } = $props();

	let photos = $state<PhotoTiers[]>([]);
	let rowSeq = 0;
	let newRows = $state<number[]>([0]);

	function addRow(): void {
		rowSeq += 1;
		newRows = [...newRows, rowSeq];
	}

	function removeRow(key: number): void {
		if (newRows.length > 1) newRows = newRows.filter((k) => k !== key);
	}
</script>

<svelte:head>
	<title>Tambah produk · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/produk" />

<main class="wrap">
	<header class="admin-head">
		<h1>Tambah produk</h1>
		<p class="muted page-sub">
			Isi nama, deskripsi, foto, dan varian (ukuran) yang dijual. Slug dan urutan tampil dibuat
			otomatis.
		</p>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}

	<form method="POST" action="?/buat" use:enhance={adminEnhance('Produk baru ditambahkan.')}>
		<div class="surface">
			<div class="field">
				<label for="nama-baru">Nama produk</label>
				<input id="nama-baru" name="name" type="text" required />
			</div>
			<div class="field">
				<label for="desc-baru">Deskripsi (tampil di halaman produk)</label>
				<textarea id="desc-baru" name="description" rows="4" required></textarea>
			</div>
			<PhotoPicker bind:photos />
			{#each photos as photo, index (index)}
				<input type="hidden" name="photos" value={JSON.stringify(photo)} />
			{/each}
		</div>

		<div class="surface">
			<p class="muted">
				Varian (ukuran) yang dijual
			</p>
			{#each newRows as rowKey (rowKey)}
				<div class="field-inline">
					<input name="v_label" type="text" placeholder="Ukuran, mis. 500 gr" aria-label="Nama ukuran" required class="input-m" />
					<input name="v_weight" type="number" min="1" step="1" placeholder="Berat (gram)" aria-label="Berat gram" required class="input-s" />
					<input name="v_price" type="text" inputmode="numeric" placeholder="Harga (rupiah)" aria-label="Harga" required class="input-m" />
					<input name="v_stock" type="number" min="0" step="1" placeholder="Stok awal" aria-label="Stok awal" value="0" required class="input-s" />
					{#if newRows.length > 1}
						<button class="btn-mini" type="button" onclick={() => removeRow(rowKey)}>Hapus baris</button>
					{/if}
				</div>
			{/each}
			<div class="btn-row">
				<button class="btn-mini" type="button" onclick={addRow}>+ Varian lain</button>
			</div>
		</div>

		<div class="btn-row">
			<button class="btn-mini is-rust" type="submit">Simpan produk</button>
			<a class="btn-mini" href="/admin/produk">Batal</a>
		</div>
	</form>
</main>

<div class="page-foot-space"></div>
