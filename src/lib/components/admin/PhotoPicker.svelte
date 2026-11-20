<script lang="ts">
	// Pemilih foto produk: satu kolom unggah, banyak foto sekaligus.
	// Foto dikompres di perangkat menjadi tiga tingkat ukuran responsif
	// (600/1200/1600px, WebP) supaya pembeli mengunduh yang paling pas.
	import type { PhotoTiers } from '#lib/photos';

	let { photos = $bindable<PhotoTiers[]>([]) } = $props();

	// Muatan gabungan dibatasi ~3 MB — batas badan permintaan Vercel 4,5 MB.
	const MAX_TOTAL_CHARS = 3 * 1024 * 1024;
	const TIER_WIDTHS = [600, 1200, 1600];

	let error = $state('');

	function encodeCanvas(canvas: HTMLCanvasElement): string {
		const url = canvas.toDataURL('image/webp', 0.9);
		// Perangkat lama yang tidak bisa enkode WebP jatuh ke JPEG kualitas tinggi.
		return url.startsWith('data:image/webp') ? url : canvas.toDataURL('image/jpeg', 0.9);
	}

	async function fileToTiers(file: File): Promise<PhotoTiers | null> {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const srcMax = Math.max(bitmap.width, bitmap.height);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const memo = new Map<number, string>();
		const encodeDim = (dim: number): string => {
			const hit = memo.get(dim);
			if (hit) return hit;
			canvas.width = Math.max(1, Math.round((bitmap.width * dim) / srcMax));
			canvas.height = Math.max(1, Math.round((bitmap.height * dim) / srcMax));
			ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			const url = encodeCanvas(canvas);
			memo.set(dim, url);
			return url;
		};
		const dims = TIER_WIDTHS.map((w) => Math.min(w, srcMax));
		// Turunan yang ukurannya sama dengan tingkat di atasnya tidak disimpan
		// ganda — endpoint jatuh ke tingkat terbesar secara otomatis.
		return {
			sm: dims[0] < dims[1] ? encodeDim(dims[0]) : '',
			md: dims[1] < dims[2] ? encodeDim(dims[1]) : '',
			lg: encodeDim(dims[2])
		};
	}

	async function onPicked(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;
		error = '';
		const picked: PhotoTiers[] = [];
		for (const file of files) {
			if (file.size > 10 * 1024 * 1024) {
				error = `Ukuran ${file.name} lebih dari 10 MB.`;
				continue;
			}
			try {
				const tiers = await fileToTiers(file);
				if (tiers && tiers.lg !== '') picked.push(tiers);
			} catch {
				error = `Foto ${file.name} tidak bisa dibaca di perangkat ini. Coba format lain (JPG/PNG).`;
			}
		}
		const kept: PhotoTiers[] = [];
		let size = photos.reduce(
			(sum, photo) => sum + photo.sm.length + photo.md.length + photo.lg.length,
			0
		);
		for (const photo of picked) {
			const weight = photo.sm.length + photo.md.length + photo.lg.length;
			if (size + weight > MAX_TOTAL_CHARS) {
				error =
					'Muatan foto sudah penuh (maksimal sekitar 3 MB per unggahan). Simpan dulu, lalu tambah foto lagi.';
				break;
			}
			kept.push(photo);
			size += weight;
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
					<img class="photo-thumb" src={photo.sm || photo.lg} alt="Pratinjau foto {index + 1}" />
					<button class="btn-mini is-danger" type="button" onclick={() => removeAt(index)}>
						Hapus
					</button>
				</span>
			{/each}
		</div>
	{/if}
</div>
