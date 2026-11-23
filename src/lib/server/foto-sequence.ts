// Urutan id foto produk: id foto WAJIB berubah setiap kali foto diganti.
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
// pengganti foto terbesar tidak pernah terlihat oleh pembeli.
//
// Menambah versi pada URL TIDAK menolong di sini: barisnya baru, dan versi
// awalnya sama-sama 1. Yang perlu berubah adalah ID-nya.
//
// CARA KERJA
//
//   1. Urutan disimpan di tabel `product_photo_seq(next_id)`, SATU baris,
//      karena `product_photos.id` adalah satu urutan untuk SEMUA produk.
//   2. Id baru = sequence + 1, dan sequence langsung dinaikkan.
//   3. Sequence juga dinaikkan melewati id tertinggi yang sudah ada, supaya
//      database lama yang dibuat dengan MAX(id)+1 tidak bertabrakan.
//
// PELAJARAN DARI KEGAGALAN PRODUKSI
//
// Versi pertama fungsi ini menulis `if (seq) UPDATE ... else INSERT ...`.
// Di database yang tabel sequence-nya ada tetapi barisnya belum ada, ia membuat
// baris. Di database yang tabelnya BELUM ada (produksi saat migrasi belum
// berjalan) ia melempar galat di tengah transaksi — dan karena dipanggil dari
// dalam transaksi penambahan produk, SELURUH transaksi dibatalkan: admin tidak
// bisa menambah produk sama sekali.
//
// Karena itu sekarang ada dua penjagaan:
//   - tabel dibuat sendiri bila belum ada (jaring pengaman bila migrasi belum
//     berjalan di database itu);
//   - bila sequence tetap tidak bisa dipakai, id dihitung dengan MAX(id)+1
//     sehingga penambahan produk TETAP BERHASIL — lebih baik kembali ke
//     perilaku lama (foto bisa tertahan cache) daripada admin tidak bisa
//     bekerja.

import type { Db } from "./db";

/** Naikkan sequence dan kembalikan id baru yang belum pernah dipakai. */
export function langkahSequence(nilaiSekarang: number, maksIdAda: number): number {
  const batas = Math.max(Number(nilaiSekarang) || 0, Number(maksIdAda) || 0);
  return batas + 1;
}

/** DDL sequence. Dijalankan hanya setelah kueri sequence terbukti gagal. */
const BUAT_SEQUENCE =
  "CREATE TABLE IF NOT EXISTS product_photo_seq (id INTEGER PRIMARY KEY, next_id INTEGER NOT NULL DEFAULT 0)";

/**
 * Ambil id foto berikutnya. Pemanggil WAJIB berada di dalam transaksi yang
 * sama dengan INSERT-nya, supaya dua penulisan bersamaan tidak mendapat id
 * yang sama.
 *
 * Tidak pernah melempar galat: kegagalan sequence diturunkan ke MAX(id)+1.
 */
export async function idFotoBerikutnya(tx: Db): Promise<number> {
  const maks = await tx.get<{ maks: number | null }>("SELECT MAX(id) AS maks FROM product_photos");
  const maksId = Number(maks?.maks ?? 0);

  const idDariSequence = await cobaSequence(tx, maksId);
  if (idDariSequence !== null) return idDariSequence;

  // Jalur cadangan: tabel sequence tidak ada dan juga tidak bisa dibuat.
  // Kembali ke perilaku lama; penambahan produk tidak boleh ikut gagal.
  return maksId + 1;
}

/** Kembalikan id dari sequence, atau null bila sequence tidak bisa dipakai. */
async function cobaSequence(tx: Db, maksId: number): Promise<number | null> {
  const baca = () =>
    tx.get<{ next_id: number }>("SELECT next_id FROM product_photo_seq WHERE id = 1");

  let seq: { next_id: number } | undefined;
  try {
    seq = await baca();
  } catch {
    // Tabel belum ada (mis. migrasi belum berjalan). Coba buat sendiri sekali,
    // supaya pemasangan baru tetap mendapat id yang hanya bergerak maju.
    try {
      await tx.run(BUAT_SEQUENCE);
      seq = await baca();
    } catch {
      return null;
    }
  }

  const id = langkahSequence(seq?.next_id ?? 0, maksId);
  try {
    if (seq) {
      await tx.run("UPDATE product_photo_seq SET next_id = ? WHERE id = 1", [id]);
    } else {
      await tx.run("INSERT INTO product_photo_seq (id, next_id) VALUES (1, ?)", [id]);
    }
  } catch {
    // Sequence ada tetapi tidak bisa ditulis (mis. hak akses). Id tetap
    // dikembalikan: id unik yang tidak tercatat lebih baik daripada gagal.
  }
  return id;
}
