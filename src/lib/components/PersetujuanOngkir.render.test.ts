import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import PersetujuanOngkir from "./PersetujuanOngkir.svelte";

/**
 * Tes teks yang BENAR-BENAR dirender dialog persetujuan ongkir.
 *
 * Kenapa ada: teks di markup ditulis "…<strong>tidak termasuk</strong> total…".
 * Formatter pernah memecah baris tepat sebelum `>total`, dan karena `total`
 * menempel langsung ke tag penutup, spasinya hilang saat dirender menjadi
 * "tidak termasuktotal". Tidak ada yang rusak, tidak ada galat build — hanya
 * kalimat yang salah baca di layar pembeli.
 *
 * Memeriksa teks sumber tidak cukup: yang menentukan adalah hasil render.
 */

function teksDialog(): string {
  const { body } = render(PersetujuanOngkir, {
    props: { terbuka: true, onlanjut: () => {}, onkembali: () => {} },
  });
  // PENTING: tag dibuang TANPA diganti spasi.
  //
  // Versi pertama tes ini memakai `.replace(/<[^>]+>/g, " ")` — dan itu cacat:
  // mengganti `</strong>` dengan spasi berarti tes MENCIPTAKAN sendiri spasi
  // yang justru sedang diuji, sehingga ia mustahil gagal pada bug aslinya
  // (sudah dibuktikan: bug dikembalikan, tes tetap hijau).
  //
  // Yang benar: buang tag apa adanya, sisakan persis karakter yang dibaca
  // pembaca layar. Tag blok tetap diberi pemisah agar kalimat tidak menyambung.
  return (
    body
      .replace(/<\/(p|h2|div|li)>/g, "\n")
      .replace(/<[^>]+>/g, "")
      // Buang indentasi + baris baru DI DALAM paragraf: di markup sumber,
      // "…</strong> total" berlanjut ke baris berikutnya, dan tanpa ini
      // hasilnya "total\n\t\t\t\t\tdi halaman bayar" — bukan kalimat utuh.
      .replace(/\s+/g, " ")
      .trim()
  );
}

describe("teks dialog persetujuan ongkir", () => {
  it("menyebut 'tidak termasuk total' dengan spasi yang benar", () => {
    const teks = teksDialog();
    expect(teks).toContain("ongkir tidak termasuk total di halaman bayar");
    // Jebakan aslinya: tanpa spasi menjadi "termasuktotal".
    expect(teks).not.toContain("termasuktotal");
  });

  it("menyebut ongkir ditanggung pembeli dan dibayar ke kurir", () => {
    const teks = teksDialog();
    expect(teks).toContain(
      "Ongkir ditanggung Anda dan dibayar langsung ke kurir saat barang sampai",
    );
  });

  it("menyebut Grab atau Gojek secara eksplisit", () => {
    const teks = teksDialog();
    expect(teks).toContain("Grab atau Gojek");
  });

  it("tidak menampilkan apa pun saat belum terbuka", () => {
    const { body } = render(PersetujuanOngkir, {
      props: { terbuka: false, onlanjut: () => {}, onkembali: () => {} },
    });
    expect(body).not.toContain("Ongkir dibayar ke kurir");
  });

  it("kedua tombol pilihan tertulis lengkap", () => {
    const teks = teksDialog();
    expect(teks).toContain("Ya, saya setuju");
    expect(teks).toContain("Belum, kembali");
  });
});
