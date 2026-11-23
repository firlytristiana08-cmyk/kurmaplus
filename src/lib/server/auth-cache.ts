// Cache verifikasi sesi admin — HANYA untuk kecepatan, bukan untuk keamanan.
//
// Latar: setiap kali admin menekan tombol di portal, sesi diverifikasi ulang
// dengan dua panggilan jaringan (Supabase `auth.getUser` + query
// `admin_users`). Satu klik "ubah status" memicu tiga verifikasi (aksi +
// layout + halaman) = 6 panggilan jaringan. Terasa lambat karena database
// berada di Singapura dan tiap round-trip puluhan milidetik.
//
// Aturan keamanan:
// - Yang di-cache HANYA hasil yang sah (sesi valid). Hasil gagal tidak pernah
//   di-cache, supaya token palsu/kadaluarsa tetap ditolak seketika.
// - Umur cache pendek (bawaan 60 detik) sehingga pencabutan akses admin tetap
//   berlaku cepat.
// - Cache bersifat per-isolate (memori proses). Bila hilang, tidak masalah:
//   verifikasi hanya diulang.
// - `clear()` dipakai saat masuk/keluar akun agar tidak ada sesi basi.

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 200) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string, now = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    // Buang entri termurah (paling awal kedaluwarsa) bila sudah penuh.
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      let oldestKey: string | null = null;
      let oldest = Infinity;
      for (const [k, entry] of this.store) {
        if (entry.expiresAt < oldest) {
          oldest = entry.expiresAt;
          oldestKey = k;
        }
      }
      if (oldestKey !== null) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Kunci cache memakai potongan hash, bukan token utuh, supaya isi memori tidak
// menyimpan kredensial penuh bila suatu saat di-log atau di-dump.
export async function cacheKeyForToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
