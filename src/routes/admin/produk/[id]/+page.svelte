<script lang="ts">
	// Ubah produk (tugas 116): detail, foto galeri (satu kolom unggah, boleh
	// banyak), varian, stok, dan hapus produk — semuanya di halaman ini.
	import { enhance } from '$app/forms';
	import BackLink from '#lib/components/BackLink.svelte';
	import { adminEnhance } from '#lib/admin-feedback';
	import PhotoPicker from '#lib/components/admin/PhotoPicker.svelte';
	import { formatRupiah } from '#lib/format';

	let { data, form } = $props();

	let photos = $state<string[]>([]);
</script>

<svelte:head>
	<title>{data.product.name} · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/produk" />

<main class="wrap">
	<header class="admin-head">
		<h1>{data.product.name}</h1>
		<p class="row-l1" style="margin: 0 0 0.25rem">
			{#if data.product.is_best_seller}<span class="badge badge-alert">Best seller</span>{/if}
			{#if !data.product.is_active}<span class="badge badge-off">Nonaktif</span>{/if}
			<span class="muted">Slug: /{data.product.slug}</span>
		</p>
		<form method="POST" action="?/produk" use:enhance={adminEnhance()} style="margin: 0.5rem 0 0">
			<input type="hidden" name="active" value={data.product.is_active ? '0' : '1'} />
			<button class="btn-mini" type="submit">
				{data.product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
			</button>
		</form>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}

	<!-- Foto galeri -->
	<div class="section-head">
		<h2>Foto</h2>
	</div>
	<div class="surface">
		{#if data.photos.length === 0}
			<p class="muted" style="margin: 0 0 0.75rem">Belum ada foto.</p>
		{:else}
			<div class="photo-row" style="margin: 0 0 0.75rem">
				{#each data.photos as photo (photo.id)}
					<span class="photo-pick">
						<img class="photo-thumb" src={photo.src} alt="Foto produk" />
						<form
							method="POST"
							action="?/foto_hapus"
							use:enhance={adminEnhance('Foto dihapus.')}
							onsubmit={(event) => {
								if (!window.confirm('Hapus foto ini?')) event.preventDefault();
							}}
						>
							<input type="hidden" name="photo_id" value={photo.id} />
							<button class="btn-mini is-danger" type="submit">Hapus</button>
						</form>
					</span>
				{/each}
			</div>
		{/if}
		<form
			method="POST"
			action="?/foto_tambah"
			use:enhance={adminEnhance('Foto ditambahkan.')}
			onsubmit={(event) => {
				if (photos.length === 0) {
					event.preventDefault();
					window.alert('Pilih minimal satu foto.');
				}
			}}
		>
			<PhotoPicker bind:photos />
			{#each photos as photo, index (index)}
				<input type="hidden" name="photos" value={photo} />
			{/each}
			<div class="btn-row" style="margin: 0.5rem 0 0">
				<button class="btn-mini is-rust" type="submit">Tambah foto</button>
			</div>
		</form>
	</div>

	<!-- Detail -->
	<div class="section-head">
		<h2>Detail</h2>
	</div>
	<form class="surface" method="POST" action="?/detail" use:enhance={adminEnhance()}>
		<input type="hidden" name="product_id" value={data.product.id} />
		<div class="field">
			<label for="nama-{data.product.id}">Nama produk</label>
			<input id="nama-{data.product.id}" name="name" type="text" value={data.product.name} required />
		</div>
		<div class="field">
			<label for="desc-{data.product.id}">Deskripsi (tampil di halaman produk)</label>
			<textarea id="desc-{data.product.id}" name="description" rows="5" required>{data.product.description}</textarea>
		</div>
		<div class="field">
			<label for="sort-{data.product.id}">Urutan tampil di katalog (kecil = lebih dulu)</label>
			<input id="sort-{data.product.id}" name="sort_order" type="number" min="0" step="1" value={data.product.sort_order} />
		</div>
		<div class="field">
			<label for="best-{data.product.id}">Tanda Best seller di katalog</label>
			<select id="best-{data.product.id}" name="best">
				<option value="0" selected={data.product.is_best_seller ? undefined : true}>Tidak</option>
				<option value="1" selected={data.product.is_best_seller ? true : undefined}>Ya, tampilkan</option>
			</select>
		</div>
		<div class="btn-row" style="margin: 0">
			<button class="btn-mini is-rust" type="submit">Simpan detail</button>
		</div>
	</form>

	<!-- Varian & stok -->
	<div class="section-head">
		<h2>Varian &amp; stok</h2>
	</div>
	{#each data.variants as variant (variant.id)}
		<div class="surface">
			<div class="row" style="align-items: flex-start; flex-direction: column; gap: 0.5rem">
				<form method="POST" action="?/varian" use:enhance={adminEnhance()} style="width: 100%">
					<input type="hidden" name="variant_id" value={variant.id} />
					<div class="row-l1" style="width: 100%; gap: 0.5rem">
						<input
							name="label"
							type="text"
							value={variant.label}
							aria-label="Nama ukuran varian"
							style="min-height: 44px; max-width: 7.5rem"
						/>
						<input
							name="weight"
							type="number"
							min="1"
							step="1"
							value={variant.weight_grams}
							aria-label="Berat {variant.label} dalam gram"
							style="min-height: 44px; max-width: 6rem"
						/>
						<span class="muted" style="font-size: 0.75rem">gram</span>
						<span style="margin-left: auto" class="tabular">{formatRupiah(variant.price_idr)}</span>
					</div>
					<div class="row-l2 tabular" style="width: 100%">
						Stok tersedia {variant.stock} · terkunci {variant.locked}
						{#if !variant.is_active}<span class="badge badge-off">Nonaktif</span>{/if}
						{#if variant.stock < data.threshold}
							<span class="badge badge-alert">
								<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M0.5 0.5 11.5 11.5M11.5 0.5 0.5 11.5" stroke="currentColor" stroke-width="2.4" /></svg>
								Stok menipis
							</span>
						{/if}
					</div>
					<div class="btn-row" style="margin: 0.25rem 0 0.75rem">
						<input
							name="price"
							type="text"
							inputmode="numeric"
							value={variant.price_idr}
							aria-label="Harga {variant.label}"
							style="min-height: 44px; max-width: 8.5rem"
						/>
						<button class="btn-mini" type="submit">Simpan</button>
						<button class="btn-mini" type="submit" name="active" value={variant.is_active ? '0' : '1'}>
							{variant.is_active ? 'Nonaktifkan' : 'Aktifkan'}
						</button>
					</div>
				</form>
				<form
					method="POST"
					action="?/stok"
					use:enhance={adminEnhance('Stok disesuaikan.', { reset: true })}
					style="width: 100%"
					onsubmit={(event) => {
						const reason = event.currentTarget.querySelector<HTMLInputElement>('input[name="reason"]');
						if (!reason || reason.value.trim() === '') {
							event.preventDefault();
							window.alert('Alasan penyesuaian stok wajib diisi.');
						}
					}}
				>
					<input type="hidden" name="variant_id" value={variant.id} />
					<div class="btn-row" style="margin: 0">
						<input name="delta" type="number" step="1" value="0" aria-label="Selisih stok" style="min-height: 44px; max-width: 5.5rem" />
						<input name="reason" type="text" placeholder="Alasan (wajib)" aria-label="Alasan penyesuaian" style="min-height: 44px; flex: 1; min-width: 9rem" />
						<button class="btn-mini is-rust" type="submit">Sesuaikan stok</button>
					</div>
				</form>
				<form
					method="POST"
					action="?/hapus"
					use:enhance={adminEnhance('Varian dihapus.')}
					style="width: 100%"
					onsubmit={(event) => {
						if (!window.confirm(`Hapus varian ${variant.label}? Hanya bisa bila belum punya riwayat pesanan/stok.`)) {
							event.preventDefault();
						}
					}}
				>
					<input type="hidden" name="variant_id" value={variant.id} />
					<button class="btn-mini" type="submit">Hapus varian</button>
				</form>
			</div>
		</div>
	{/each}

	<div class="surface">
		<form method="POST" action="?/tambah" use:enhance={adminEnhance('Varian baru ditambahkan.', { reset: true })} style="margin-top: 0.5rem">
			<input type="hidden" name="product_id" value={data.product.id} />
			<p class="muted" style="margin: 0.5rem 0 0.25rem; font-size: 0.8125rem">Tambah varian baru</p>
			<div class="btn-row" style="margin: 0">
				<input name="label" type="text" placeholder="Ukuran, mis. 500 gr" aria-label="Nama ukuran baru" required style="min-height: 44px; max-width: 8.5rem" />
				<input name="weight" type="number" min="1" step="1" placeholder="Berat (gram)" aria-label="Berat gram" required style="min-height: 44px; max-width: 7rem" />
			</div>
			<div class="btn-row" style="margin: 0.5rem 0 0">
				<input name="price" type="text" inputmode="numeric" placeholder="Harga (rupiah)" aria-label="Harga baru" required style="min-height: 44px; max-width: 8.5rem" />
				<input name="stock" type="number" min="0" step="1" placeholder="Stok awal" aria-label="Stok awal" required style="min-height: 44px; max-width: 6.5rem" />
				<button class="btn-mini is-rust" type="submit">Tambah varian</button>
			</div>
		</form>
	</div>

	<!-- Hapus produk -->
	<div class="section-head">
		<h2>Zona berbahaya</h2>
	</div>
	<div class="surface">
		<p class="muted" style="margin: 0 0 0.75rem">
			Hapus permanen menghilangkan produk, seluruh varian, foto, dan riwayat stoknya. Item
			pesanan lama tetap tersimpan. Tidak bisa dibatalkan.
		</p>
		<form
			method="POST"
			action="?/hapus_produk"
			use:enhance={adminEnhance('Produk dihapus.')}
			onsubmit={(event) => {
				if (!window.confirm(`Hapus produk ${data.product.name} beserta seluruh variannya? Tidak bisa dibatalkan.`)) {
					event.preventDefault();
				}
			}}
		>
			<button class="btn-mini is-danger" type="submit">Hapus produk</button>
		</form>
	</div>
</main>

<div class="page-foot-space"></div>
