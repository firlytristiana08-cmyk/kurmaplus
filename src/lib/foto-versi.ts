// Penanda versi foto produk.
//
// MASALAH YANG DISELESAIKAN: sebelum ini URL foto selalu `/api/foto/{id}`,
// tanpa penanda apa pun. Begitu sebuah foto diganti, URL-nya tetap sama —
// sehingga tiga lapis cache menahan foto LAMA:
//
//   1. service worker (static/sw.js): untuk gambar, cache dulu baru jaringan;
//   2. header endpoint: `max-age=31536000, immutable` — satu tahun, final;
//   3. cache HTTP/CDN mana pun di antaranya.
//
// Akibatnya foto baru bisa tidak pernah muncul, dan tidak ada cara memaksanya
// selain menghapus cache browser secara manual.
//
// SOLUSI: sertakan versi foto di URL (`?v=`). Versi berubah setiap foto
// disimpan, sehingga URL-nya ikut berubah. URL baru = tidak ada cache lama
// yang cocok = foto langsung segar. Foto yang TIDAK berubah memakai versi
// yang sama, jadi tetap terlayani dari cache — cepat dan hemat kuota.
//
// Modul ini murni (tanpa dependensi server) supaya bisa dipakai komponen,
// endpoint, dan tes.
import type { PhotoTiers } from "./photos";

/** Parameter versi di URL foto. */
export const FOTO_VERSI_PARAM = "v";

/** Naikkan satu tingkat saat isi foto berubah. Naik monoton, tidak diacak. */
export function versiBerikutnya(versiSekarang: number | null | undefined): number {
  const sekarang = Number(versiSekarang ?? 0);
  return (Number.isFinite(sekarang) && sekarang > 0 ? Math.floor(sekarang) : 0) + 1;
}

/**
 * Apakah isi foto benar-benar berubah?
 *
 * Dipakai agar versi hanya naik saat perlu. Kalau admin menekan "Simpan" tanpa
 * mengubah foto, versi tidak naik — URL tetap, cache tetap terpakai.
 */
export function isiBerubah(
  lama: { data: string; data_sm: string | null; data_md: string | null },
  baru: PhotoTiers,
): boolean {
  return (
    lama.data !== baru.lg || (lama.data_sm ?? "") !== baru.sm || (lama.data_md ?? "") !== baru.md
  );
}

/**
 * Tempelkan parameter versi ke sebuah URL foto.
 *
 * Aman untuk URL yang sudah punya query (`?w=600`) maupun yang belum.
 * Versi kosong/0 tidak ditempelkan supaya URL lama tetap valid.
 */
export function denganVersi(url: string, versi: number | null | undefined): string {
  const v = Number(versi ?? 0);
  if (!Number.isFinite(v) || v <= 0) return url;
  const pemisah = url.includes("?") ? "&" : "?";
  return `${url}${pemisah}${FOTO_VERSI_PARAM}=${Math.floor(v)}`;
}
