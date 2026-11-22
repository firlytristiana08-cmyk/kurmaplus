// Alamat publik aplikasi untuk URL yang dikirim ke DOKU (callback kembali ke
// situs dan URL notifikasi webhook).
//
// Kenapa tidak memakai `url.origin` saja: di belakang proksi/dev worker origin
// bisa berbeda dari alamat yang dijangkau DOKU. `PUBLIC_BASE_URL` (var publik,
// bukan rahasia — ada di wrangler.jsonc) menjadikannya eksplisit. Bila kosong,
// perilaku lama tetap dipakai agar Vercel/lokal tidak berubah.
const candidates = ["PUBLIC_BASE_URL", "APP_BASE_URL"];

export function publicBaseUrl(fallbackOrigin: string): string {
  for (const name of candidates) {
    const value = (process.env[name] ?? "").trim();
    if (value === "") continue;
    try {
      return new URL(value).origin;
    } catch {
      // Nilai tidak sah diabaikan — jangan sampai pembayaran gagal hanya
      // karena salah tulis di konfigurasi.
    }
  }
  return fallbackOrigin;
}
