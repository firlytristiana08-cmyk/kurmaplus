# KURMAPLUS — Daftar Periksa Go-Live (Produksi)

Dokumen ini berisi hal-hal yang **harus** diisi/diaktifkan sebelum toko menerima
pesanan nyata, beserta cara memeriksanya. Rahasia (kata sandi, kunci API) **tidak
pernah** ditulis di berkas ini maupun di `wrangler.jsonc` — semuanya diisi lewat
dasbor Cloudflare sebagai **Secret**, atau lewat halaman Admin → Pengaturan.

Status terakhir diperiksa: 22 November 2026.

---

## 1. Status saat ini (sudah beres)

| Hal | Keadaan |
|---|---|
| Aplikasi produksi | Worker `kurmaplus` → `https://kurmaplus.hasbidiqi16.workers.dev` |
| Database | Supabase `dmwtrtcehxjcweoanbsx` lewat Hyperdrive `HYPERDRIVE` |
| Katalog & pesanan | Stabil (pool `pg` per pakai, gagal koneksi tidak dikunci) |
| Login admin | 1 email terdaftar di `admin_users`: `hasbidiqi16@gmail.com` |
| Produk | 3 produk, 9 varian |
| Worker uji DOKU | `kurmaplus-dev` (sandbox) — terpisah dari produksi |
| Pengaman DOKU | Fail-closed: produksi wajib `DOKU_BASE_URL` eksplisit |

---

## 2. Secret Worker `kurmaplus` (dasbor Cloudflare)

Cloudflare → Workers & Pages → **kurmaplus** → Settings → Variables and Secrets
→ **Add** → pilih **Secret**.

| Nama | Nilai | Akibat bila kosong |
|---|---|---|
| `DOKU_CLIENT_ID` | dari `dashboard.doku.com` (production) | Checkout berjalan dalam mode simulasi |
| `DOKU_SECRET_KEY` | production | idem |
| `DOKU_BASE_URL` | `https://api.doku.com` | **Pembayaran daring dimatikan** (pengaman fail-closed) |
| `SUPABASE_DB_PASSWORD` | kata sandi database Supabase | Aplikasi tidak bisa membaca/menulis data |

Bukan rahasia — sudah ada di `wrangler.jsonc`: `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`, `PUBLIC_BASE_URL`,
`DOKU_ENV=production`.

> Catatan: `wrangler deploy` **menimpa** variabel biasa dari `wrangler.jsonc`,
> tetapi **tidak** menimpa Secret. Karena itu semua rahasia harus bertipe Secret.

---

## 3. Dashboard DOKU **production** (`dashboard.doku.com`)

1. **Settings → API Keys** — pastikan memakai kredensial **production**
   (bukan sandbox).
2. **Settings → Payment Settings** — untuk **setiap** metode yang dijual,
   set Payment Notification URL:
   `https://kurmaplus.hasbidiqi16.workers.dev/api/webhook/doku`
3. **Settings → Checkout Page → System Settings → Whitelist Domain** —
   daftarkan `kurmaplus.hasbidiqi16.workers.dev` (dan custom domain nanti).
4. Aktifkan metode pembayaran yang dipakai (QRIS, Virtual Account, e-Wallet).
5. Opsional: **Settings → Accept Payments → Checkout Appearance → Expired
   Settings** → nyalakan Expired Notification ke URL yang sama.

> Aplikasi juga mengirim `override_notification_url` per transaksi, jadi
> notifikasi pembayaran utama tetap sampai meski dashboard belum lengkap.
> Setting dashboard tetap diperlukan untuk notifikasi kedaluwarsa dan
> pemantauan/penagihan ulang lewat **Settings → Notifications → HTTP
> Notifications**.

---

## 4. Isian lewat Admin → Pengaturan (bukan di dasbor Cloudflare)

Masuk ke `/admin` → **Pengaturan**. Nilai-nilai ini tersimpan di tabel
`settings` milik toko.

| Isian | Kunci DB | Keadaan sekarang | Kenapa penting |
|---|---|---|---|
| Nomor WhatsApp toko (format `62…`) | `shop_whatsapp` | ⚠️ **masih contoh** `6281234567890` | Tombol "Chat WhatsApp" di halaman pesanan menuju nomor ini |
| Keadaan toko | `store_open` | `1` (buka) | Menutup/membuka pemesanan |
| Tanggal libur | `closed_dates` | `[]` | Tanggal yang tidak bisa dipilih pembeli |
| Info pengiriman | `shipping_info_text` | terisi (21–22 Nov) | Ditampilkan di halaman katalog/checkout |
| Batas tanggal pesan | `order_cutoff_weekday/time` | Kamis, 23:59 | Kapan pemesanan minggu itu ditutup |
| Batas waktu bayar | `payment_timeout_minutes` | 60 menit | Kedaluwarsa sesi DOKU |
| Kapasitas harian | `daily_capacity` | 20 | Kuota kirim per tanggal |
| Ambang stok rendah | `low_stock_threshold` | 10 | Peringatan di dasbor admin |
| Template WhatsApp | `wa_templates` | terisi | Pesan konfirmasi/tagih/pindah tanggal |

> **Nomor WhatsApp wajib diganti** sebelum menerima pesanan nyata — jangan
> biarkan pembeli diarahkan ke `6281234567890`.

---

## 5. Yang belum ada dan perlu keputusan Anda

### 5.1 Email konfirmasi ke pembeli
**Saat ini aplikasi belum mengirim email apa pun.** Email pembeli hanya
disimpan sebagai data pesanan. Agar pembeli menerima konfirmasi, perlu
ditambahkan pengiriman email (mis. penyedia Resend/SMTP) plus Secret baru
(`EMAIL_API_KEY`, alamat pengirim) — ini pekerjaan kode baru, bukan sekadar
isian.

Bila belum siap: pastikan alur tetap jelas tanpa email —
- halaman pesanan menampilkan kode pesanan dan tombol WhatsApp,
- pembeli diarahkan kembali ke halaman pesanan setelah bayar.

### 5.2 Notifikasi ke pemilik (opsional, sudah ada kodenya)
`TELEGRAM_BOT_TOKEN` (Secret) + isian `notify_chat_id` (Admin → Pengaturan).
Bila kosong, notifikasi dilewati tanpa mengganggu pembayaran.

### 5.3 Halaman diagnosis
`/diagnostics` masih aktif. Sebaiknya dihapus/dikunci **setelah** semua uji
selesai — halaman ini menampilkan (tersamar) informasi konfigurasi.

---

## 6. Urutan uji sebelum menerima pesanan nyata

1. Isi semua Secret pada bagian 2 → deploy ulang.
2. Buka `/diagnostics` → bagian **Kredensial DOKU** dan **Koneksi API DOKU**
   harus hijau (probe hanya `GET status` invoice dummy, tanpa transaksi).
3. Ganti nomor WhatsApp toko pada bagian 4.
4. Transaksi percobaan **bernilai kecil** dengan uang sungguhan.
5. Periksa hasilnya:
   - status pesanan berubah menjadi **dibayar**,
   - muncul di **DOKU → Settings → Notifications → HTTP Notifications**,
   - stok berkurang, dan pesanan tampil di `/admin/pesanan`.
6. Hapus/uji data percobaan bila perlu.

---

## 7. Catatan operasional

- Migrasi database produksi dijalankan **manual** (tidak ada pelacak
  `schema_migrations` di Supabase). Setiap berkas baru di `db/migrations/`
  harus dijalankan sendiri di Supabase → SQL Editor.
- Deploy produksi dilakukan lewat Cloudflare Builds setelah PR digabung ke
  `main`; `wrangler deploy` dari komputer hanya untuk Worker dev.
- Jangan menaruh rahasia di `wrangler.jsonc` atau `.dev.vars` yang di-commit.

## 6. Cache Hyperdrive — WAJIB dimatikan

Hyperdrive **meng-cache hasil query secara bawaan**: `max_age` 60 detik +
`stale_while_revalidate` 15 detik. Cloudflare tidak membatalkan cache saat
aplikasi menulis ke database, sehingga perubahan di panel admin baru terlihat
setelah **~75 detik** — di portal admin maupun portal pelanggan. Ini pernah
terjadi dan membingungkan pemilik toko.

Sudah dimatikan 23 Nov 2026: Cloudflare → Storage & Databases → Hyperdrive →
konfigurasi `HYPERDRIVE` → **Caching → Disable**.

Kenapa dimatikan, bukan diatur ulang:

- Toko ini punya 3 produk; query yang identik dalam 60 detik hampir tidak ada,
  jadi cache praktis tidak pernah kena — seluruh risiko basi tanpa manfaat.
- Kecepatan Hyperdrive yang sebenarnya berasal dari **connection pooling**
  (menghapus 7 round-trip: TCP, TLS, autentikasi). Itu tetap bekerja walau
  caching dimatikan (dokumentasi Cloudflare menyatakannya eksplisit).
- Cache ikut menahan **sesi admin** (`admin-auth.ts` memakai `getDB()`), jadi
  admin yang sudah logout masih dianggap masuk sampai 75 detik.

Kalau kelak butuh cache lagi untuk katalog, buat konfigurasi Hyperdrive KEDUA
dengan `--caching-disabled` untuk jalur admin/pasca-tulis — jangan mengaktifkan
cache pada jalur yang menulis.
