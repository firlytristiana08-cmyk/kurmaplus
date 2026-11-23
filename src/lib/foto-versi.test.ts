import { describe, expect, it } from "vitest";
import { denganVersi, FOTO_VERSI_PARAM, isiBerubah, versiBerikutnya } from "./foto-versi";

/**
 * Tes penanda versi foto.
 *
 * Inti masalah yang dijaga: URL foto pernah tidak pernah berubah, sehingga
 * cache satu tahun + service worker cache-dulu menahan foto lama selamanya.
 * Versi di URL adalah satu-satunya cara membuat browser melihat URL baru.
 */

describe("versiBerikutnya", () => {
  it("bukti masalah: versi naik dari kosong menjadi 1", () => {
    expect(versiBerikutnya(null)).toBe(1);
    expect(versiBerikutnya(undefined)).toBe(1);
    expect(versiBerikutnya(0)).toBe(1);
  });

  it("naik satu tingkat, bukan melompat", () => {
    expect(versiBerikutnya(1)).toBe(2);
    expect(versiBerikutnya(7)).toBe(8);
  });

  it("nilai rusak tidak membuat versi mundur", () => {
    // Versi yang mundur berarti URL lama bisa muncul lagi = foto basi kembali.
    expect(versiBerikutnya(-5)).toBe(1);
    expect(versiBerikutnya(Number.NaN)).toBe(1);
  });
});

describe("denganVersi", () => {
  it("menempelkan versi ke URL tanpa query", () => {
    expect(denganVersi("/api/foto/7", 2)).toBe("/api/foto/7?v=2");
  });

  it("memakai & bila URL sudah punya query (srcset w=)", () => {
    // Salah pakai '?' di sini akan merusak parameter w dan srcset.
    expect(denganVersi("/api/foto/7?w=600", 3)).toBe("/api/foto/7?w=600&v=3");
  });

  it("URL tetap utuh bila versi kosong — foto lama tetap berfungsi", () => {
    expect(denganVersi("/api/foto/7", null)).toBe("/api/foto/7");
    expect(denganVersi("/api/foto/7", 0)).toBe("/api/foto/7");
    expect(denganVersi("/api/foto/7?w=600", undefined)).toBe("/api/foto/7?w=600");
  });

  it("nama parameter sesuai yang dibaca endpoint", () => {
    expect(FOTO_VERSI_PARAM).toBe("v");
  });
});

describe("isiBerubah", () => {
  const lama = { data: "data:image/webp;base64,AAA", data_sm: "data:sm", data_md: "data:md" };

  it("tidak naik versi bila isinya sama", () => {
    // Penting: admin menekan Simpan tanpa mengganti foto tidak boleh
    // membuang cache yang sudah dimiliki pembeli.
    expect(isiBerubah(lama, { lg: lama.data, sm: "data:sm", md: "data:md" })).toBe(false);
  });

  it("naik versi bila foto utama berubah", () => {
    expect(
      isiBerubah(lama, { lg: "data:image/webp;base64,BBB", sm: "data:sm", md: "data:md" }),
    ).toBe(true);
  });

  it("naik versi bila turunan kecil berubah", () => {
    expect(isiBerubah(lama, { lg: lama.data, sm: "data:sm2", md: "data:md" })).toBe(true);
  });

  it("null pada turunan diperlakukan seperti kosong", () => {
    const tanpaTurunan = { data: "x", data_sm: null, data_md: null };
    expect(isiBerubah(tanpaTurunan, { lg: "x", sm: "", md: "" })).toBe(false);
  });
});
