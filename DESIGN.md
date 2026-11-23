# DESIGN.md — KurmaPlus

Sistem visual yang dipakai KurmaPlus, ditulis dari kode nyata (`src/app.css`,
`src/routes/admin/admin.css`, komponen). Tujuannya: fitur baru terasa seperti
bagian dari produk yang sama, bukan tambalan.

Berkas ini **merekam apa yang ada**, termasuk ketidakkonsistenannya (lihat
[Utang desain](#utang-desain)). Kalau Anda mengubah sistem, ubah berkas ini.

---

## 1. Prinsip

Diambil dari perilaku produk yang sebenarnya, bukan slogan:

| Prinsip | Bukti di produk |
|---|---|
| **Satu kolom, gaya ponsel** | `.wrap` maksimal 430 px, termasuk di desktop — kecuali halaman data-padat (`.is-wide`, 860 px) |
| **Status terbaca tanpa warna** | Lencana memakai bentuk penanda ○ ● ■ ▲ ★ ◇ ✕, bukan hanya warna |
| **Angka rata kanan, tabular** | `.tabular` pada semua nominal, jumlah, tanggal |
| **Tidak ada yang bergerak kecuali perlu** | Satu animasi (spinner sibuk); `prefers-reduced-motion` mematikan semuanya |
| **Hormati kertas** | `@media print` serius: A4, 14 mm, hitam-putih, satu pesanan per lembar |

Kalau ragu antara "terlihat modern" dan "terbaca di bawah matahari saat
mengantar pesanan", pilih yang kedua.

---

## 2. Warna

Semua di `src/app.css` sebagai CSS custom property. **Jangan menulis nilai
heksadesimal baru di komponen** — pakai token.

### Palet

| Token | Nilai | Peran |
|---|---|---|
| `--ink` / `--tinta` | `#241710` | Teks utama, garis tegas. Cokelat hampir hitam, bukan `#000` |
| `--paper` | `#f4ede0` | Latar halaman — warna ampas kurma |
| `--card` | `#fffdf8` | Permukaan kartu. Putih hangat, bukan `#fff` |
| `--sand` | `#e7dac3` | Garis tepi, pemisah, latar nonaktif |
| `--rust` | `#ab3710` | **Aksi utama** dan tautan. Satu-satunya warna "panggil" |
| `--rust-press` | `#96300d` | Keadaan ditekan untuk `--rust` |
| `--olive` | `#4a5a2b` | Berhasil / selesai / terkonfirmasi |
| `--brick` | `#9b2c2c` | Bahaya / galat / hapus |

### Aturan pemakaian

- **`--rust` hanya untuk satu hal per layar**: aksi utama. Kalau ada dua tombol
  rust di satu kartu, salah satu seharusnya `.btn-mini` biasa.
- **`--olive` tidak pernah dipakai untuk teks di atas `--paper`** (kontras
  rendah); hanya di atas `--card`.
- **`--brick` boleh dipakai untuk teks** di atas `--card` (7,40:1) — sudah
  diuji.
- **Warna bukan pembawa makna tunggal.** Selalu sertakan teks atau bentuk.

### Teks redup

Peran ini **belum dijadikan token** dan itu masalah (lihat [Utang desain](#utang-desain)):

```css
/* Yang dipakai sekarang, tersebar di 8 tempat */
color: #73685f;                                            /* fallback */
color: color-mix(in srgb, var(--ink) 62%, var(--paper));   /* asli */
```

Kontras: **4,66:1** di atas `--paper` (lolos AA), 4,90:1 di atas `--card`.

### Pengecualian sadar: `cream-palette`

Detektor Impeccable menandai latar `#f4ede0` sebagai *cream / beige palette* —
"permukaan AI yang paling refleks". Peringatan itu berlaku untuk produk yang
memilih krem sebagai jalan aman.

**Di sini krem bukan jalan aman, melainkan warna kurma** — identitas toko, dan
sudah disetujui pemilik pada mockup. Karena itu dipertahankan, dengan dua
syarat:

1. Jangan menambah lapisan krem di atas krem (kartu di dalam kartu) — lihat R-1.
2. Kontras `--ink` di atas krem harus tetap ≥ 7:1 (sekarang 14,97:1).

Peringatan ini dicatat supaya keputusannya terlihat, bukan supaya diabaikan
tanpa alasan.

### Kontras yang sudah diukur

| Pasangan | Rasio | Status |
|---|---|---|
| `--ink` di `--paper` | 14,97:1 | ✓ |
| `--ink` di `--card` | 17,14:1 | ✓ |
| teks redup di `--paper` | 4,66:1 | ✓ (pas) |
| `--rust` di `--paper` | 5,49:1 | ✓ |
| `--rust` di `--card` | 6,29:1 | ✓ |
| `--olive` di `--card` | 7,41:1 | ✓ |
| `--brick` di `--card` | 7,40:1 | ✓ |
| **pemisah rantai status** | **2,19:1** | ✗ **gagal** |

---

## 3. Tipografi

Dua muka huruf, **di-host sendiri** (`/fonts/*.woff2`, tanpa permintaan ke pihak
luar — penting untuk privasi dan kecepatan).

| Peran | Muka huruf | Berat | Ukuran |
|---|---|---|---|
| Judul (`h1`–`h3`) | **Young Serif** | 400 | h1 25 px · h2 20 px · h3 17 px |
| Isi, label, tombol | **Figtree** | 400 / 700 / 800 | dasar 16 px, `line-height` 1.55 |

Aturan:

- **Judul selalu tegak.** Tidak ada judul serif miring — itu penanda template AI.
- **Jangan tambah muka huruf ketiga.** Dua sudah cukup dan keduanya berkarakter.
- **Ukuran isi tidak pernah di bawah 14 px**; teks isi ideal 16 px.
- **Teks fungisional minimal 12 px.** 11 px (bilah tab) adalah batas bawah yang
  ditoleransi, tidak boleh ditiru untuk hal baru.
- **`letter-spacing`** hanya untuk wordmark (0,02 em). Jangan menyebarkan huruf
  pada teks isi.

### Skala ukuran

```
25px  h1  judul halaman
20px  h2  judul bagian
17px  h3  judul kartu
16px  isi, input, tombol utama
15px  baris daftar (row-l1), label tebal
14px  teks redup standar (.muted), tautan kecil
13px  baris kedua daftar (row-l2), lencana
12px  hint, keterangan cetak
11px  label bilah tab  ← batas bawah
```

---

## 4. Jarak

Skala 4 px dengan langkah yang dipakai sungguhan:

```
4px   .25rem   rapat dalam satu baris
6px   .375rem  ikon ↔ teks di lencana
8px   .5rem    antar chip, antar baris tombol
12px  .75rem   dalam kartu
18px  1.125rem padding kartu (.surface)
20px  1.25rem  jarak antar bagian (.section-head atas)
16px  padding tepi halaman (.wrap)
```

**Aturan ritme:** rapat untuk yang berhubungan (4–8 px), longgar antar bagian
(20 px). Jarak yang seragam di mana-mana menghasilkan halaman yang datar;
kalau semua sama, tidak ada yang menonjol.

---

## 5. Bentuk

### Radius — tiga langkah, bukan empat

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--radius-s` | 0,625 rem (10 px) | input, kotak galat, thumbnail |
| `--radius-m` | 1 rem (16 px) | — **belum dipakai, cadangkan atau hapus** |
| `--radius-l` | 1,625 rem (26 px) | `.surface` (kartu) |

Radius **melengkung penuh** (`999px`) hanya untuk `.badge`.

> Nilai lepas `0.8125rem` (13 px) pada `.btn`, `.chip`, `.toast` dan
> `0.6875rem` (11 px) pada `.btn-mini` adalah utang — lihat bawah.

### Garis tepi

- Kartu: `1px solid var(--sand)`.
- Input: `1.5px solid var(--sand)`; saat fokus `2px solid var(--rust)` —
  ketebalan berubah, jadi tidak ada lompatan tata letak karena `border-box`.
- **Jangan** memakai garis aksen di satu sisi kotak lengkung. Itu penanda
  template yang paling mudah dikenali.

### Bayangan

Hanya dua pemakaian yang dibenarkan:

- Tombol utama: `0 8px 16px -8px rgb(171 55 16 / .85)` — memberi "berat".
- Bilah lengket & toast: lembut, satu lapis.

**Jangan** memberi kartu daftar bayangan **dan** garis tepi sekaligus.

---

## 6. Komponen

### Tombol

| Kelas | Tinggi | Bentuk | Kapan |
|---|---|---|---|
| `.btn` | 50 px | penuh, latar `--rust` | **Satu** aksi utama per layar |
| `.btn-secondary` | 50 px | penuh, bingkai `--ink` | Aksi kedua yang setara |
| `.btn-mini` | 44 px | seukuran isi, bingkai `--ink` | Aksi per baris/kartu |
| `.btn-mini.is-rust` | 44 px | latar `--rust` | Aksi utama di dalam kartu |
| `.btn-mini.is-danger` | 44 px | teks `--brick` | Hapus/batalkan |
| `.chip` | 44 px | bingkai tipis, radius 13 px | **Saringan** (bukan aksi) |
| `.chip.is-active` | 44 px | bingkai + teks `--rust` | Saringan terpilih |

Aturan:

- Target sentuh **minimum 44 × 44 px**. Ini sudah terpenuhi; jangan turunkan.
- Tombol teks saja (tanpa bingkai) **tidak ada** — selalu ada bentuk.
- Aksi merusak selalu meminta konfirmasi (`window.confirm`) dan menyebutkan
  akibatnya ("Tidak bisa dibatalkan").

### Kartu (`.surface`)

`--card` + `1px --sand` + `--radius-l` + padding 18 px.

Satu kartu = satu **satuan yang berdiri sendiri**. Untuk formulir panjang
(Pengaturan), pakai satu kartu dengan pemisah — bukan tiga kartu bertumpuk.

### Baris daftar (`.row`)

Dua tingkat:

```
┌ baris 1  15px tebal   kode · nama · [lencana] · waktu redup
└ baris 2  13px redup   tanggal · kota · kurir · nominal · ongkir
```

Tinggi minimum 56 px, pemisah `1px --sand` antarbaris, `›` di kanan sebagai
penanda "bisa dibuka". Baris yang bisa diklik berubah latar saat disentuh
(`--ink` 4%).

### Lencana status (`.badge`)

Teks + **bentuk** + warna. Bentuknya sengaja berbeda-beda supaya terbaca di
cetak hitam-putih dan oleh pembaca layar:

| Status | Bentuk | Kelas |
|---|---|---|
| Menunggu bayar | ○ cincin | `badge-wait` |
| Dibayar | ● bulat penuh | `badge-ok` |
| Dikemas | ■ kotak | `badge-ok` |
| Dikirim | ▲ segitiga | `badge-wait` |
| Selesai | ★ bintang | `badge-ok` |
| Kedaluwarsa | ◇ belah ketupat | `badge-off` |
| Dibatalkan | ✕ silang | `badge-alert` |

### Bilah tab bawah

Empat tujuan, ikon padat 22 px, label 11 px, tinggi 62 px. Tab aktif:
`--rust` + garis 3 px di atas. `padding-bottom: env(safe-area-inset-bottom)`
wajib — sudah ada.

### Notifikasi (`.toast`)

Di **tengah layar**, bukan menempel di bawah (di bawah tertutup bilah tab).
Durasi 2,6 detik untuk sukses, 4,2 detik untuk galat. Galat memakai
`role="alert"`.

---

## 7. Gerak

- Durasi: **150 ms** untuk transisi keadaan (latar, skala).
- Easing: `ease-out`. **Jangan** pakai pantulan/`cubic-bezier` berlebih.
- Yang beranimasi hanya: tombol ditekan (`scale .975`), latar baris, spinner
  sibuk.
- Tidak ada animasi masuk, tidak ada elemen berdenyut, tidak ada kursor berkedip.
- `prefers-reduced-motion: reduce` mematikan **semua** animasi dan transisi.

---

## 8. Menulis teks

Bahasa: **Indonesia, sapaan "Anda", tanpa istilah teknis di permukaan**.

| Lakukan | Hindari |
|---|---|
| "Stok menipis — sisa 3" | "Warning: low inventory threshold exceeded" |
| "Tombol konfirmasi aktif setelah nominal diisi" | "Validasi gagal" |
| "Tidak bisa dibatalkan" | "Ireversible operation" |
| Angka: `Rp1.211.000` | `Rp 1211000` atau `1211000` |
| Tanggal: `23 Nov 2026` | `2026-11-23` (kecuali di `<input type="date">`) |

Label tombol = kata kerja + objek: "Tandai dikirim", bukan "OK" atau "Simpan".

**Setiap galat menjawab tiga hal:** apa yang terjadi, kenapa, dan apa yang harus
dilakukan. Contoh yang sudah benar di Beranda:

> **Pembayaran DOKU belum aktif.** DOKU_CLIENT_ID dan DOKU_SECRET_KEY belum
> terisi… **Tindakan:** Isi sebagai Secret di Cloudflare → …

---

## 9. Keadaan yang wajib ada

Untuk setiap daftar atau angka di portal:

1. **Kosong** — kalimat yang menjelaskan, bukan ruang kosong. Contoh sudah baik:
   "Belum ada pesanan yang menunggu tindakan."
2. **Sibuk** — tombol memakai `use:enhance` → kelas `.is-busy` (spinner), tombol
   nonaktif selama proses. Jangan biarkan tombol bisa ditekan dua kali.
3. **Galat** — `.error-box` di atas isi, bukan alert peramban, kecuali
   konfirmasi merusak.
4. **Berhasil** — toast singkat, bukan halaman baru.

---

## 10. Format teknis

- **CSS ditulis di berkas `.css`**, bukan `<style>` di dalam komponen, untuk
  semua yang dipakai lebih dari sekali. Inline `style="…"` hanya untuk nilai
  sekali pakai.
- **Satu arah pewarisan:** token di `:root` (`app.css`) → komponen admin
  (`admin.css`). Komponen tidak menimpa token.
- **Jangan menulis aturan global** (pemilih `html`, `body`, `*`) dari dalam CSS
  admin. Semua di-scope ke `.admin-scope`.
- **Mobile-first**, satu titik puncak: `@media (min-width: 900px)` memperlebar
  kolom. Tidak ada tata letak kedua.

---

## 11. Utang desain

**Sudah dilunasi 23 November 2026** (lihat `docs/audit-desain-admin.md`):

| Dulu | Sekarang |
|---|---|
| Teks redup tanpa token & tanpa fallback (8 tempat) | `--redup` / `--redup-lemah` berfallback |
| `overflow-x: clip` global dari CSS admin | Dihapus; `scrollbar-gutter` saja |
| Heading melompat h1 → h3 | Semua halaman `1-2-2…` |
| Pemisah status 2,19:1 | 3,91:1 |
| 100 inline style | **0** |
| Radius 4 nilai | 3 token, tanpa nilai lepas |
| Saringan 2 pola | 1 pola (isi → Terapkan) |
| Tanggal tanpa `<label for>` | Semua terhubung |
| `--radius-m` token mati | Dipakai tombol/chip/toast (12 px) |

**Sisa yang sengaja dibiarkan** (butuh keputusan Anda, bukan perbaikan teknis):

| # | Hal | Catatan |
|---|---|---|
| 1 | Ikon tab "Lainnya" = `⋯` | Sebaiknya diganti ikon yang menggambarkan isi (Pengaturan/Laporan/Log) |
| 2 | Detail pesanan memakai 13 kartu berurutan | Tiap bagian berdiri sendiri; menggabungkan butuh uji cetak ulang |
| 3 | `cream-palette` ditandai detektor | **Dipertahankan** — itu warna kurma, bukan refleks. Lihat §2 |
| 4 | `PageHeader`/`PageFooter` 430 px hardcoded | Belum diubah; tidak ada gejala, butuh uji visual |

Portal pelanggan: **nol inline style**, nol nilai radius lepas, nol `color-mix`
teks tanpa token. Lihat `docs/audit-desain-pelanggan.md`.

---

## 12. Aksesibilitas

Berlaku untuk portal pelanggan **dan** admin. Ini bukan lampiran — ini bagian
dari sistem.

### Fokus keyboard

Semua elemen interaktif mendapat garis fokus yang sama, didefinisikan sekali di
`app.css` dengan `:where()` (kekhususan nol, jadi komponen tetap boleh
menimpanya):

```css
:where(button, [href], input, select, textarea, [tabindex]):focus-visible {
  outline: 3px solid var(--rust);
  outline-offset: 2px;
}
```

Di atas latar gelap (lightbox, modal) warnanya diganti `--paper`. `--rust` di
atas `#26222f` hanya 2,43:1 — gagal.

**Jangan** menulis `outline: none` tanpa pengganti.

### Dialog modal

Setiap elemen dengan `role="dialog"` **wajib** memakai `use:focusDialog`
(`src/lib/focus-dialog.ts`). Yang dilakukan aksi itu:

1. memindahkan fokus ke isi pertama,
2. menjebak Tab/Shift+Tab di dalam dialog,
3. mengembalikan fokus ke elemen pemicu saat ditutup,
4. mengunci gulir latar selama terbuka.

`aria-modal="true"` tanpa ini adalah kebohongan: pembaca layar tetap membaca
halaman di belakang.

Bila isi dialog dirender bersyarat (`{#if terbuka}`), **jangan** taruh id yang
dirujuk `aria-controls` di dalam blok itu — gunakan `hidden` agar elemen selalu
ada di DOM.

### Status & pilihan

Status tidak pernah disampaikan lewat warna saja:

- Lencana status: teks + **bentuk** (○ ● ■ ▲ ★ ◇ ✕).
- Tombol pilihan (ukuran produk): `aria-pressed`.
- Isian yang berubah tampil saat terpilih: `:has(input:checked)` + `aria`.

### Kontras

Ambang yang dipakai: **4,5:1** teks biasa, **3:1** teks besar, **3:1** elemen
grafis bermakna (ikon yang menjadi satu-satunya isi). Ikon hiasan boleh lebih
rendah.

Yang sudah diukur dan **gagal** lalu diperbaiki:

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Ikon "foto belum tersedia" | 2,10:1 | 3,65:1 |
| Pemisah rantai status (admin) | 2,19:1 | 3,91:1 |
| Titik galeri aktif di lightbox | sudah 15,5:1 | ✓ |

---

## 13. Cara memeriksa pekerjaan sendiri

1. `npm run check` — 0 galat, 0 peringatan.
2. `npm run test` — semua lulus.
3. Jalankan `impeccable detect` terhadap HTML hasil render (bukan tebakan).
4. Hitung kontras setiap pasangan warna baru (AA 4,5:1 teks, 3:1 elemen).
5. Uji di 430 px **dan** 900 px.
6. Cetak satu pesanan ke PDF — harus terbaca hitam-putih.
7. Matikan JavaScript di peramban: formulir harus tetap bisa dikirim.
8. Tab saja (tanpa tetikus) dari atas halaman: fokus harus selalu terlihat, dan
   tidak boleh keluar dari dialog yang sedang terbuka.
9. Saat aksinya "jelas benar", **rusak sengaja** lalu pastikan tes atau
   pemeriksaan Anda benar-benar gagal. Tes yang selalu hijau tidak membuktikan
   apa pun.
