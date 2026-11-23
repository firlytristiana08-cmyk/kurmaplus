// Versi foto produk: id foto kini BERUBAH setiap kali foto diganti.
//
// MASALAH YANG DISELESAIKAN
//
// Sebelum ini, id foto dibuat dengan `SELECT COALESCE(MAX(id), 0) + 1 FROM
// product_photos`. Foto produk selalu diganti dengan hapus-lalu-tambah, jadi
// urutannya begini:
//
//   1. foto #6 dihapus;
//   2. foto pengganti mendapat id = MAX(id) + 1.
//
// Bila #6 adalah id terbesar, foto pengganti mendapat id 6 LAGI — URL yang
// sama persis. Sementara endpoint mengirim `max-age=31536000, immutable` dan
// service worker menyimpan gambar dengan strategi cache-dulu. Akibatnya
// pengganti foto terbesar tidak pernah terlihat oleh pembeli: cache menyajikan
// foto lama untuk URL yang sama, dan tidak ada cara memaksanya selain
// membersihkan cache browser secara manual.
//
// Menambah versi pada URL TIDAK menolong di sini: barisnya baru, dan versi
// awalnya sama-sama 1. Yang perlu berubah adalah ID-nya.
//
// Memakai MAX(id)+1 dari SEMUA baris (termasuk milik produk lain) tetaplah
// menghasilkan id yang sudah pernah dipakai, karena MAX(id) bisa saja milik
// baris yang barusan dihapus. Karena itu “sampah” id tidak boleh dikumpulkan
// ulang: setelah id dipakai sekali, ia tidak boleh dipakai lagi.
//
// CARA KERJA
//
//   1. Urutan (sequence) penghasil id disimpan di tabel product_photo_seq.
//   2. Id baru = sequence + 1, dan sequence langsung dinaikkan.
//   3. Sequence juga dinaikkan melewati id tertinggi yang sudah ada, supaya
//      database lama yang dibuat dengan MAX(id)+1 tidak bertabrakan.

import type { Db } from "./db";

/** Naikkan sequence dan kembalikan id baru yang belum pernah dipakai. */
export function langkahSequence(nilaiSekarang: number, maksIdAda: number): number {
  const batas = Math.max(Number(nilaiSekarang) || 0, Number(maksIdAda) || 0);
  return batas + 1;
}

/**
 * Ambil id foto berikutnya. Pemanggil WAJIB berada di dalam transaksi yang
 * sama dengan INSERT-nya, supaya dua penulisan bersamaan tidak mendapat id
 * yang sama.
 */
export async function idFotoBerikutnya(tx: Db): Promise<number> {
  const seq = await tx.get<{ next_id: number }>(
    "SELECT next_id FROM product_photo_seq WHERE id = 1",
  );
  const maks = await tx.get<{ maks: number | null }>("SELECT MAX(id) AS maks FROM product_photos");
  const id = langkahSequence(seq?.next_id ?? 0, Number(maks?.maks ?? 0));
  if (seq) {
    await tx.run("UPDATE product_photo_seq SET next_id = ? WHERE id = 1", [id]);
  } else {
    await tx.run("INSERT INTO product_photo_seq (id, next_id) VALUES (1, ?)", [id]);
  }
  return id;
}
