import { describe, expect, it } from "vitest";
import { langkahSequence } from "./foto-sequence";

/**
 * Tes urutan id foto.
 *
 * BUG YANG DIJAGA — ini bug nyata, bukan hipotetis:
 *
 * Id foto dulu dibuat dengan `SELECT COALESCE(MAX(id), 0) + 1`. Foto produk
 * diganti dengan hapus-lalu-tambah. Bila yang dihapus adalah foto berid
 * TERBESAR, foto pengganti mendapat id yang SAMA — URL-nya identik dengan
 * sebelumnya. Karena endpoint mengirim `immutable` selama satu tahun dan
 * service worker menyimpan gambar lebih dulu daripada jaringan, foto
 * pengganti tidak pernah terlihat oleh pembeli.
 *
 * Urutan yang hanya bergerak maju menutup celah itu: id yang sudah dipakai
 * tidak pernah dipakai lagi.
 */

describe("langkahSequence", () => {
  it("memberi id baru di atas sequence yang ada", () => {
    expect(langkahSequence(10, 3)).toBe(11);
  });

  it("bukti bug lama: setelah id tertinggi dihapus, id TIDAK dipakai ulang", () => {
    // Kondisi lama: MAX(id) = 5 dan baris id 5 baru saja dihapus, sehingga
    // MAX(id) turun menjadi 4. Dengan MAX(id)+1 hasilnya 5 — id yang sama
    // dengan foto yang baru dihapus = URL sama = foto basi.
    const maksIdSetelahHapus = 4;
    const sequenceTersimpan = 5; // sequence ingat bahwa 5 sudah pernah dipakai
    const idBaru = langkahSequence(sequenceTersimpan, maksIdSetelahHapus);
    expect(idBaru).toBe(6);
    expect(idBaru).not.toBe(5);
  });

  it("database lama tanpa sequence tetap aman: mulai dari id tertinggi yang ada", () => {
    // product_photo_seq baru dibuat di migrasi 0012 dan diisi MAX(id) saat itu,
    // tetapi bila kosong (0) pun tidak boleh bertabrakan.
    expect(langkahSequence(0, 9)).toBe(10);
  });

  it("id selalu naik walau dipanggil berulang", () => {
    let seq = 0;
    let maks = 0;
    const hasil: number[] = [];
    for (let i = 0; i < 5; i++) {
      const id = langkahSequence(seq, maks);
      hasil.push(id);
      seq = id;
      maks = id; // simulasi baris baru tersimpan
    }
    expect(hasil).toEqual([1, 2, 3, 4, 5]);
    // Tidak ada yang berulang — inilah syarat agar URL foto selalu baru.
    expect(new Set(hasil).size).toBe(hasil.length);
  });

  it("tahan nilai rusak dari database", () => {
    expect(langkahSequence(Number.NaN, 3)).toBe(4);
    expect(langkahSequence(0, Number.NaN)).toBe(1);
  });
});
