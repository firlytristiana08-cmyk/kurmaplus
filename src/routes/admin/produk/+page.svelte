<script lang="ts">
	// Produk, detail, dan stok — daftar baris di HP (PRD — Arah desain).
	// Seluruh detail produk diatur di sini (tugas 90); penyesuaian stok selalu
	// bercatatan (BA-08); perubahan harga hanya untuk pesanan baru (BA-09).
	import { enhance } from '$app/forms';
	import { adminEnhance } from '#lib/admin-feedback';
	import { formatDateTimeId, formatRupiah, photoSrc } from '#lib/format';

	let { data, form } = $props();

	const reasonLabels: Record<string, string> = {
		lock_order: 'Terkunci pesanan',
		expire_return: 'Kembali (kedaluwarsa)',
		cancel_return: 'Kembali (dibatalkan)',
		adjustment: 'Penyesuaian manual',
		stock_initial: 'Stok awal varian baru',
	};

	let products = $derived.by(() => {
		const map = new Map<
			number,
			{
				id: number;
				name: string;
				description: string;
				photo: string | null;
				photo2: string | null;
				photo3: string | null;
				sort: number;
				active: number;
				best: number;
				variants: (typeof data.variants)[number][];
			}
		>();
		for (const row of data.variants) {
			let entry = map.get(row.product_id);
			if (!entry) {
				entry = {
					id: row.product_id,
					name: row.product_name,
					description: row.product_description,
					photo: row.product_photo,
					photo2: row.product_photo_2,
					photo3: row.product_photo_3,
					sort: row.product_sort,
					active: row.product_active,
					best: row.product_best,
					variants: [],
				};
				map.set(row.product_id, entry);
			}
			entry.variants.push(row);
		}
		return [...map.values()];
	});

	let editing = $state<number | null>(null);

	// --- Tambah produk ---
	let adding = $state(false);
	let rowSeq = 0;
	let newRows = $state<number[]>([0]);

	function addRow(): void {
		rowSeq += 1;
		newRows = [...newRows, rowSeq];
	}

	function removeRow(key: number): void {
		if (newRows.length > 1) newRows = newRows.filter((k) => k !== key);
	}

	// --- Unggah foto: dikecilkan di perangkat (maks 1600px, WebP) ---
	async function fileToDataUrl(file: File): Promise<string> {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL('image/webp', 0.9);
	}

	async function onPhotoPicked(event: Event, key: string): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !input.form) return;
		if (file.size > 10 * 1024 * 1024) {
			window.alert('Ukuran foto maksimal 10 MB.');
			input.value = '';
			return;
		}
		const dataUrl = await fileToDataUrl(file);
		if (dataUrl === '') return;
		const hidden = input.form.querySelector<HTMLInputElement>(`input[data-photo-value="${key}"]`);
		const preview = input.form.querySelector<HTMLImageElement>(`img[data-photo-preview="${key}"]`);
		if (hidden) hidden.value = dataUrl;
		if (preview) {
			preview.src = dataUrl;
			preview.hidden = false;
		}
		input.value = '';
	}

	function clearPhoto(event: Event, key: string): void {
		const button = event.currentTarget as HTMLButtonElement;
		const form = button.form ?? button.closest('form');
		if (!form) return;
		const hidden = form.querySelector<HTMLInputElement>(`input[data-photo-value="${key}"]`);
		const preview = form.querySelector<HTMLImageElement>(`img[data-photo-preview="${key}"]`);
		const file = form.querySelector<HTMLInputElement>(`input[data-photo-file="${key}"]`);
		if (hidden) hidden.value = '';
		if (preview) {
			preview.src = '';
			preview.hidden = true;
		}
		if (file) file.value = '';
	}
</script>

<svelte:head>
	<title>Produk · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<h1>Produk &amp; stok</h1>
		<p class="muted page-sub">
			Nama, deskripsi, foto, harga, dan varian diatur di sini. Harga baru hanya untuk pesanan baru
			(BA-09). Stok disesuaikan dengan alasan, tidak pernah negatif (BA-08).
		</p>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}

	{#snippet photoField(key: string, slotName: string, labelText: string, current: string | null)}
		<div class="field">
			<label for={`file-${key}`}>{labelText}</label>
			<div class="photo-row">
				<img
					class="photo-thumb"
					data-photo-preview={key}
					src={photoSrc(current)}
					alt="Pratinjau foto"
					hidden={!current}
				/>
				<input
					id={`file-${key}`}
					type="file"
					accept="image/*"
					data-photo-file={key}
					onchange={(event) => onPhotoPicked(event, key)}
				/>
				<button class="btn-mini" type="button" onclick={(event) => clearPhoto(event, key)}>
					Hapus foto
				</button>
			</div>
			<input type="hidden" name={slotName} value={current ?? ''} data-photo-value={key} />
		</div>
	{/snippet}

	<div class="section-head">
		<h2>Produk</h2>
		<div class="btn-row" style="margin: 0">
			<button class="btn-mini is-rust" type="button" onclick={() => (adding = !adding)}>
				{adding ? 'Tutup form' : 'Tambah produk'}
			</button>
		</div>
	</div>

	{#if adding}
		<form
			class="surface"
			method="POST"
			action="?/tambah_produk"
			use:enhance={adminEnhance('Produk baru ditambahkan.', { reset: true })}
		>
			<div class="field">
				<label for="nama-baru">Nama produk</label>
				<input id="nama-baru" name="name" type="text" required />
			</div>
			<div class="field">
				<label for="desc-baru">Deskripsi (tampil di halaman produk)</label>
				<textarea id="desc-baru" name="description" rows="4" required></textarea>
			</div>
			{@render photoField('n-1', 'photo', 'Foto utama', null)}
			{@render photoField('n-2', 'photo_2', 'Foto kedua (opsional)', null)}
			{@render photoField('n-3', 'photo_3', 'Foto ketiga (opsional)', null)}
			<p class="muted" style="margin: 0.5rem 0 0.25rem; font-size: 0.8125rem">Varian (ukuran) yang dijual</p>
			{#each newRows as rowKey (rowKey)}
				<div class="btn-row" style="margin: 0 0 0.5rem">
					<input name="v_label" type="text" placeholder="Ukuran, mis. 500 gr" aria-label="Nama ukuran" required style="min-height: 44px; max-width: 8.5rem" />
					<input name="v_weight" type="number" min="1" step="1" placeholder="Berat (gram)" aria-label="Berat gram" required style="min-height: 44px; max-width: 7rem" />
					<input name="v_price" type="text" inputmode="numeric" placeholder="Harga (rupiah)" aria-label="Harga" required style="min-height: 44px; max-width: 8.5rem" />
					<input name="v_stock" type="number" min="0" step="1" placeholder="Stok awal" aria-label="Stok awal" value="0" required style="min-height: 44px; max-width: 6.5rem" />
					{#if newRows.length > 1}
						<button class="btn-mini" type="button" onclick={() => removeRow(rowKey)}>Hapus baris</button>
					{/if}
				</div>
			{/each}
			<div class="btn-row" style="margin: 0">
				<button class="btn-mini" type="button" onclick={addRow}>+ Varian lain</button>
				<button class="btn-mini is-rust" type="submit">Simpan produk</button>
			</div>
		</form>
	{/if}

	{#each products as product (product.id)}
		<div class="section-head">
			<h2>
				{product.name}
				{#if product.best}<span class="badge badge-alert">Best seller</span>{/if}
				{#if !product.active}<span class="badge badge-off">Nonaktif</span>{/if}
			</h2>
			<div class="btn-row" style="margin: 0">
				<button
					class="btn-mini"
					type="button"
					onclick={() => (editing = editing === product.id ? null : product.id)}
				>
					{editing === product.id ? 'Tutup detail' : 'Ubah detail'}
				</button>
				<form method="POST" action="?/produk" use:enhance={adminEnhance()}>
					<input type="hidden" name="product_id" value={product.id} />
					<input type="hidden" name="active" value={product.active ? '0' : '1'} />
					<button class="btn-mini" type="submit">{product.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
				</form>
				<form
					method="POST"
					action="?/hapus_produk"
					use:enhance={adminEnhance('Produk dihapus.')}
					onsubmit={(event) => {
						if (!window.confirm(`Hapus produk ${product.name} beserta seluruh variannya? Tidak bisa dibatalkan.`)) {
							event.preventDefault();
						}
					}}
				>
					<input type="hidden" name="product_id" value={product.id} />
					<button class="btn-mini is-danger" type="submit">Hapus produk</button>
				</form>
			</div>
		</div>

		{#if editing === product.id}
			<form class="surface" method="POST" action="?/detail" use:enhance={adminEnhance()}>
				<input type="hidden" name="product_id" value={product.id} />
				<div class="field">
					<label for="nama-{product.id}">Nama produk</label>
					<input id="nama-{product.id}" name="name" type="text" value={product.name} required />
				</div>
				<div class="field">
					<label for="desc-{product.id}">Deskripsi (tampil di halaman produk)</label>
					<textarea id="desc-{product.id}" name="description" rows="5" required>{product.description}</textarea>
				</div>
				{@render photoField(`e${product.id}-1`, 'photo', 'Foto utama', product.photo)}
				{@render photoField(`e${product.id}-2`, 'photo_2', 'Foto kedua (opsional)', product.photo2)}
				{@render photoField(`e${product.id}-3`, 'photo_3', 'Foto ketiga (opsional)', product.photo3)}
				<div class="field">
					<label for="sort-{product.id}">Urutan tampil di katalog (kecil = lebih dulu)</label>
					<input id="sort-{product.id}" name="sort_order" type="number" min="0" step="1" value={product.sort} />
				</div>
				<div class="field">
					<label for="best-{product.id}">Tanda Best seller di katalog</label>
					<select id="best-{product.id}" name="best">
						<option value="0" selected={product.best ? undefined : true}>Tidak</option>
						<option value="1" selected={product.best ? true : undefined}>Ya, tampilkan</option>
					</select>
				</div>
				<div class="btn-row" style="margin: 0">
					<button class="btn-mini is-rust" type="submit">Simpan detail</button>
					<button class="btn-mini" type="button" onclick={() => (editing = null)}>Batal</button>
				</div>
			</form>
		{/if}

		<div class="surface">
			{#each product.variants as variant (variant.id)}
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
						use:enhance={adminEnhance("Stok disesuaikan.", { reset: true })}
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
			{/each}

			<form method="POST" action="?/tambah" use:enhance={adminEnhance("Varian baru ditambahkan.", { reset: true })} style="margin-top: 0.5rem">
				<input type="hidden" name="product_id" value={product.id} />
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
	{/each}

	<div class="section-head">
		<h2>Riwayat stok</h2>
	</div>
	<div class="surface">
		{#if data.movements.length === 0}
			<p class="muted" style="margin: 0">Belum ada pergerakan stok.</p>
		{:else}
			<ul class="timeline">
				{#each data.movements as mv (mv.id)}
					<li>
						<span class="when">{formatDateTimeId(mv.created_at)} · {mv.actor}</span>
						Varian #{mv.variant_id} · {mv.delta > 0 ? `+${mv.delta}` : mv.delta} —
						{reasonLabels[mv.reason] ?? mv.reason}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>

<div class="page-foot-space"></div>
