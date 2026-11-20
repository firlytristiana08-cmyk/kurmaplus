<script lang="ts">
	// Pemilih foto produk: satu kolom unggah, banyak foto sekaligus.
	// Foto dikompres di perangkat (maks 1600px, WebP) menjadi URL data.
	let { photos = $bindable<string[]>([]) } = $props();

	// Muatan gabungan dibatasi ~3 MB — batas badan permintaan Vercel 4,5 MB.
	const MAX_TOTAL_CHARS = 3 * 1024 * 1024;

	let error = $state('');

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

	async function onPicked(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;
		error = '';
		const picked: string[] = [];
		for (const file of files) {
			if (file.size > 10 * 1024 * 1024) {
				error = `Ukuran ${file.name} lebih dari 10 MB.`;
				continue;
			}
			try {
				const dataUrl = await fileToDataUrl(file);
				if (dataUrl !== '') picked.push(dataUrl);
			} catch {
				error = `Foto ${file.name} tidak bisa dibaca di perangkat ini. Coba format lain (JPG/PNG).`;
			}
		}
		const kept: string[] = [];
		let size = photos.reduce((sum, photo) => sum + photo.length, 0);
		for (const photo of picked) {
			if (size + photo.length > MAX_TOTAL_CHARS) {
				error = 'Muatan foto sudah penuh (maksimal sekitar 3 MB per unggahan). Simpan dulu, lalu tambah foto lagi.';
				break;
			}
			kept.push(photo);
			size += photo.length;
		}
		photos = [...photos, ...kept].slice(0, 20);
	}

	function removeAt(index: number): void {
		photos = photos.filter((_, i) => i !== index);
	}
</script>

<div class="field">
	<label for="photo-picker">Pilih foto (boleh lebih dari satu)</label>
	<input id="photo-picker" type="file" accept="image/*" multiple onchange={onPicked} />
	{#if error}<p class="error-box" style="margin: 0.5rem 0 0">{error}</p>{/if}
	{#if photos.length > 0}
		<div class="photo-row" style="margin-top: 0.5rem">
			{#each photos as photo, index (index)}
				<span class="photo-pick">
					<img class="photo-thumb" src={photo} alt="Pratinjau foto {index + 1}" />
					<button class="btn-mini is-danger" type="button" onclick={() => removeAt(index)}>
						Hapus
					</button>
				</span>
			{/each}
		</div>
	{/if}
</div>
