// Tes cache verifikasi sesi admin.
//
// Dua hal yang dijaga:
// 1. Kecepatan: verifikasi yang sama tidak diulang dalam jendela TTL.
// 2. Keamanan: hasil GAGAL tidak pernah di-cache, dan kunci cache tidak
//    menyimpan token mentah.
import { describe, expect, it } from "vitest";
import { cacheKeyForToken, TtlCache } from "./auth-cache";

describe("TtlCache", () => {
  it("mengembalikan nilai yang masih berlaku", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("a", "sesi-a", 1_000);
    expect(cache.get("a", 2_000)).toBe("sesi-a");
  });

  it("berhenti berlaku tepat setelah TTL", () => {
    const cache = new TtlCache<string>(1_000);
    cache.set("a", "sesi-a", 0);
    expect(cache.get("a", 999)).toBe("sesi-a");
    expect(cache.get("a", 1_000)).toBeNull();
    // Entri kedaluwarsa dibersihkan, bukan menumpuk.
    expect(cache.size).toBe(0);
  });

  it("kunci yang tidak ada mengembalikan null", () => {
    const cache = new TtlCache<string>(1_000);
    expect(cache.get("tidak-ada")).toBeNull();
  });

  it("delete() menghapus satu kunci (dipakai saat keluar akun)", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("a", "sesi-a");
    cache.set("b", "sesi-b");
    cache.delete("a");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("sesi-b");
  });

  it("clear() mengosongkan semuanya", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("a", "sesi-a");
    cache.set("b", "sesi-b");
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("membuang entri paling awal kedaluwarsa saat penuh", () => {
    const cache = new TtlCache<string>(60_000, 2);
    cache.set("lama", "x", 0);
    cache.set("baru", "y", 1_000);
    cache.set("terbaru", "z", 2_000);
    expect(cache.size).toBe(2);
    // Pemeriksaan memakai jam yang sama dengan penyimpanan (2_500 ms), supaya
    // tidak bergantung pada waktu asli saat tes berjalan.
    const now = 2_500;
    // Yang paling awal kedaluwarsa (diset paling awal) yang dibuang.
    expect(cache.get("lama", now)).toBeNull();
    expect(cache.get("baru", now)).toBe("y");
    expect(cache.get("terbaru", now)).toBe("z");
  });

  it("menimpa nilai kunci yang sama tanpa menambah entri", () => {
    const cache = new TtlCache<string>(60_000, 2);
    cache.set("a", "versi-1");
    cache.set("a", "versi-2");
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe("versi-2");
  });
});

describe("cacheKeyForToken", () => {
  it("tidak memakai token mentah sebagai kunci", async () => {
    const token = "jwt-rahasia-yang-tidak-boleh-tersimpan";
    const key = await cacheKeyForToken(token);
    expect(key).not.toContain(token);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("deterministik: token sama → kunci sama", async () => {
    expect(await cacheKeyForToken("abc")).toBe(await cacheKeyForToken("abc"));
  });

  it("token berbeda → kunci berbeda", async () => {
    expect(await cacheKeyForToken("abc")).not.toBe(await cacheKeyForToken("abd"));
  });
});
