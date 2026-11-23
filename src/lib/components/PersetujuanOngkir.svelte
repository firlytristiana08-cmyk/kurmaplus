<script lang="ts">
	/**
	 * Dialog persetujuan ongkir sebelum masuk checkout.
	 *
	 * Alasan ada: ongkir Grab/Gojek TIDAK termasuk total di halaman bayar —
	 * pelanggan membayarnya langsung ke kurir saat barang sampai. Pembeli yang
	 * tidak tahu hal ini bisa merasa ditagih dua kali. Dialog ini meminta
	 * persetujuan eksplisit lebih dulu, bukan mengandalkan catatan kecil yang
	 * mudah terlewat.
	 *
	 * Dua tombol, dan keduanya jujur soal akibatnya:
	 *  - "Ya, saya setuju"  -> lanjut ke checkout (`onlanjut`).
	 *  - "Belum, kembali"   -> TIDAK jadi ke checkout (`onkembali`), dan
	 *                          keranjang tidak disentuh sama sekali.
	 *
	 * Catatan implementasi:
	 *  - `role="dialog"` wajib `use:focusDialog` (DESIGN.md §12) — tanpa itu
	 *    `aria-modal` berbohong kepada pembaca layar.
	 *  - `focusDialog` TIDAK mengunci gulir latar; `$effect` di bawah yang
	 *    melakukannya.
	 *  - Escape diperlakukan sama seperti "Belum, kembali", supaya tombol
	 *    Escape tidak pernah berarti "lanjut".
	 */
	import { focusDialog } from '#lib/focus-dialog';

	let { terbuka, onlanjut, onkembali }: {
		terbuka: boolean;
		onlanjut: () => void;
		onkembali: () => void;
	} = $props();

	// Kunci gulir latar selama dialog terbuka, pulihkan nilai sebelumnya.
	$effect(() => {
		if (!terbuka) return;
		const sebelumnya = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = sebelumnya;
		};
	});

	// Pengumuman ke pembaca layar dilakukan peramban saat fokus masuk ke dialog
	// bertanda aria-modal (dipindahkan focusDialog) — tidak perlu kode tambahan.
</script>

{#if terbuka}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="persetujuan-ongkir-judul"
		aria-describedby="persetujuan-ongkir-isi"
		tabindex="-1"
		use:focusDialog
		onclick={onkembali}
		onkeydown={(event) => event.key === 'Escape' && onkembali()}
	>
		<div
			class="modal-kotak"
			role="presentation"
			onclick={(event) => event.stopPropagation()}
		>
			<img
				class="modal-gambar"
				src="/images/kurir-ongkir.webp"
				alt="Kurir pengiriman membawa box pesanan"
				width="440"
				height="248"
				decoding="async"
			/>

			<h2 id="persetujuan-ongkir-judul">Ongkir dibayar ke kurir</h2>

			<div id="persetujuan-ongkir-isi" class="modal-isi">
				<p>
					Untuk pengiriman <strong>Grab atau Gojek</strong>, ongkir <strong>tidak termasuk</strong
					>total di halaman bayar.
				</p>
				<p>
					Ongkir ditanggung Anda dan <strong>dibayar langsung ke kurir</strong> saat barang sampai.
				</p>
			</div>

			<div class="modal-aksi">
				<button type="button" class="btn btn-secondary" onclick={onkembali}>Belum, kembali</button>
				<button type="button" class="btn" onclick={onlanjut}>Ya, saya setuju</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: rgba(36, 23, 16, 0.55);
		background: color-mix(in srgb, var(--ink) 55%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
	}

	.modal-kotak {
		width: 100%;
		max-width: 22rem;
		max-height: calc(100dvh - 2.5rem);
		overflow-y: auto;
		background: var(--card);
		border-radius: var(--radius-m);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	/* GIF kurir. Latarnya putih, jadi sudutnya dibuat membulat agar tidak
	   tampak seperti kotak putih menempel di kartu krem. */
	.modal-gambar {
		width: 100%;
		height: auto;
		aspect-ratio: 440 / 248;
		object-fit: cover;
		border-radius: var(--radius-s);
		background: #fff;
	}

	.modal-kotak h2 {
		margin: 0;
		font-size: 1.125rem;
		line-height: 1.3;
	}

	.modal-isi {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.modal-isi p {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--redup);
	}

	.modal-isi strong {
		color: var(--ink);
	}

	.modal-aksi {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
		margin-top: 0.25rem;
	}

	/* Di layar sempit dua tombol bersebelahan memaksa teks terpotong.
	   Tumpuk vertikal, tombol setuju di bawah (ibu jari lebih mudah). */
	@media (max-width: 360px) {
		.modal-aksi {
			grid-template-columns: 1fr;
		}
	}
</style>
