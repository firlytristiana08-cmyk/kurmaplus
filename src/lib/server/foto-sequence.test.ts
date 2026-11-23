import { describe, expect, it } from "vitest";
import type { Db } from "./db";
import { idFotoBerikutnya, langkahSequence } from "./foto-sequence";

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

describe("idFotoBerikutnya: tidak boleh mematikan penambahan produk", () => {
  // Kesalahan nyata di produksi: tabel product_photo_seq belum ada karena
  // migrasi belum berjalan, kueri sequence melempar galat di tengah transaksi,
  // dan SELURUH transaksi penambahan produk ikut dibatalkan.
  type SqlValue = string | number | null;
  function buatDb(opsi: { adaTabel: boolean; bisaBuat: boolean; gagalTulis?: boolean }) {
    const data = new Map<number, number>();
    const db = {
      async get<T>(sql: string): Promise<T | undefined> {
        if (sql.includes("MAX(id)")) return { maks: 7 } as unknown as T;
        if (sql.includes("FROM product_photo_seq")) {
          if (!opsi.adaTabel) throw new Error("no such table: product_photo_seq");
          const nilai = data.get(1);
          return nilai === undefined ? undefined : ({ next_id: nilai } as unknown as T);
        }
        return undefined;
      },
      async run(sql: string, params: SqlValue[] = []) {
        if (sql.startsWith("CREATE TABLE")) {
          if (!opsi.bisaBuat) throw new Error("permission denied");
          opsi.adaTabel = true;
          return { changes: 0 };
        }
        if (opsi.gagalTulis) throw new Error("read only");
        data.set(1, Number(params[0]));
        return { changes: 1 };
      },
      // Anggota lain dari antarmuka Db tidak dipakai fungsi yang diuji.
      // Dibuat melempar supaya pemakaian tak terduga langsung ketahuan.
      async all<T>(): Promise<T[]> {
        throw new Error("all() tidak dipakai");
      },
      async transaction<T>(): Promise<T> {
        throw new Error("transaction() tidak dipakai");
      },
    } as unknown as Db;
    return db;
  }

  it("tabel belum ada -> tetap memberi id (TIDAK melempar galat)", async () => {
    const db = buatDb({ adaTabel: false, bisaBuat: false });
    // Ini yang dulu membatalkan seluruh transaksi penambahan produk.
    await expect(idFotoBerikutnya(db)).resolves.toBe(8);
  });

  it("tabel bisa dibuat sendiri -> id berikutnya melanjutkan sequence", async () => {
    const db = buatDb({ adaTabel: false, bisaBuat: true });
    expect(await idFotoBerikutnya(db)).toBe(8);
    // Sequence kini tercatat; id berikutnya naik, tidak memakai 8 lagi.
    expect(await idFotoBerikutnya(db)).toBe(9);
  });

  it("sequence tidak bisa ditulis -> id tetap diberikan", async () => {
    const db = buatDb({ adaTabel: true, bisaBuat: true, gagalTulis: true });
    await expect(idFotoBerikutnya(db)).resolves.toBe(8);
  });
});
