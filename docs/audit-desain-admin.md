# Audit desain Portal Admin

Tanggal: 23 November 2026
Cakupan: seluruh halaman `/admin/**` (Hari ini, Pesanan, detail pesanan, Produk,
ubah produk, Tambah produk, Lainnya, Pengaturan, Laporan, Log audit, Log
transaksi, Masuk).
Metode: lihat bagian **Cara audit** di bawah — bukan penilaian selera.

---

> **Status: temuan Tinggi & Sedang sudah diperbaiki** (lihat
> [Hasil perbaikan](#hasil-perbaikan)). Bagian di bawah tetap dipertahankan
> sebagai catatan apa yang salah dan mengapa — bukan sebagai daftar tugas
> terbuka.

## Ringkasan

Portal admin **tidak** menderita penyakit "AI slop" yang biasa. Paletnya khas
(cream/rust/olive), tipografinya berkarakter (Young Serif + Figtree, bukan
Inter), dan bahasa visualnya konsisten dengan portal pelanggan.

Yang bermasalah bukan *gaya*, melainkan **kerapian teknis**: 100 inline style,
~50 penimpaan margin untuk melawan margin global, dua masalah struktur
heading, satu kegagalan kontras, dan beberapa pola interaksi yang tidak
konsisten antarhalaman.

| Tingkat | Jumlah | Arti |
|---|---|---|
| **Tinggi** | 4 | Terlihat pengguna / melanggar aksesibilitas |
| **Sedang** | 5 | Tidak konsisten, menyulitkan perawatan |
| **Rendah** | 4 | Utang teknis, belum berdampak |

---

## Cara audit

1. **Detektor Impeccable resmi** (`impeccable detect`, v4.10.0, 62 aturan)
   dijalankan terhadap **HTML hasil render** 8 halaman admin dari dev server,
   bukan terhadap tebakan. Hasil: **2 temuan** (`skipped-heading`).
2. **Kontras dihitung manual** dari token warna nyata (`src/app.css`), memakai
   rumus WCAG 2.1 — deteksi statis tidak mengukur kontras pada `color-mix()`.
3. **Penelusuran kode** untuk pola yang mustahil dideteksi dari satu halaman
   (inline style, penimpaan CSS, konsistensi tombol).

---

## Tinggi

### T-1. `color-mix()` tanpa fallback efektif di semua teks redup

`--ink` = `#241710`. Deklarasi `color: color-mix(in srgb, var(--ink) 62%, var(--paper))`
**tanpa heksadesimal fallback** ada di `src/routes/admin/admin.css` (baris 33,
46, 262, 300, 325, 349, 391, 482) dan `src/app.css` (`.muted` **memang punya**
fallback `#73685f`, sisanya tidak konsisten).

Peramban yang tidak mendukung `color-mix()` membuang deklarasi itu dan jatuh ke
warna warisan — yaitu `--ink` penuh. Akibatnya teks redup berubah menjadi
hitam pekat, dan **hierarki informasi hilang** persis di halaman yang paling
padat (daftar pesanan, log audit).

Catatan: fallback yang ditulis di `app.css` (`#73685f`) juga **tidak sama**
dengan hasil `color-mix` (`#776e68` di kartu / `#73685f` di kertas). Dua warna
berbeda untuk peran yang sama.

**Perbaikan:** jadikan satu token `--redup` (dan `--redup-lemah`), tulis
fallback heksadesimal **lalu** `color-mix`, dan ganti seluruh pemakaian.

### T-2. `overflow-x: clip` dipasang di `html` dari dalam CSS admin

`src/routes/admin/admin.css` baris ~437 menulis aturan `html { overflow-x: clip }`
di tingkat global. Itu:
- **bukan** `admin-scope` — ikut berlaku di portal pelanggan;
- mematikan gulir mendatar sebagai *gejala*, bukan menyembunyikan penyebabnya,
  sehingga elemen yang meluber di layar 430 px akan **terpotong tanpa tanda**
  (dan pemotongan teks tak terlihat lebih buruk daripada gulir).

**Perbaikan:** hapus aturan global itu, pindahkan ke `.admin-scope` bila masih
perlu, dan perbaiki elemen yang sebenarnya meluber.

### T-3. Struktur heading melompat (temuan detektor, 2 halaman)

- `laporan`: `<h1>Laporan` → `<h3>Ringkasan` (h2 tidak ada)
- `pengaturan`: `<h1>Pengaturan toko` → `<h3>Toko` (h2 tidak ada)

Pembaca layar memakai hierarki heading sebagai daftar isi. Melompati tingkat
membuat navigasi pembaca layar rusak di halaman yang justru paling panjang.

**Perbaikan:** `<h3>` → `<h2>` di kedua halaman.

### T-4. Pemisah "·" di rantai status gagal kontras

`.stepchain .sep` memakai `--ink` 35% → **2,19:1** terhadap kartu (AA butuh
3:1 untuk elemen non-teks yang bermakna). Di layar redup, pemisah antar langkah
hilang dan teks menyatu.

**Perbaikan:** naikkan ke 55% (3,91:1) atau ganti pemisah dengan jarak/garis.

---

## Sedang

### S-1. 100 inline style di 10 berkas admin

Terbanyak: `produk/[id]` (30), `pesanan/[kode]` (25), `+page` (11). Isinya
pengulangan, bukan pengecualian:

| Pola berulang | Kemunculan |
|---|---|
| `margin-top: 0` (melawan `h3` global) | 16 |
| `margin: 0` (melawan `p`/`surface` global) | 15 |
| `cursor: default` (chip yang bukan tautan) | 7 |
| `min-height: 44px; max-width: …` (kotak isian varian) | 12 |
| `min-height: 32px; border: none; background: transparent` (isian di dalam chip) | 6 |

Akibatnya dua sumber kebenaran untuk jarak dan ukuran. Setiap perubahan global
harus diburu ke inline style.

**Perbaikan:** pindahkan ke kelas di `admin.css` (`.flush`, `.chip-static`,
`.field-inline`, `.input-s`), sisakan inline hanya untuk nilai yang benar-benar
satu kali pakai.

### S-2. Tombol "Terapkan" bertabrakan dengan filter yang mengirim sendiri

Di **Pesanan**: `<select name="kurir">` dan `<input type="date">` memanggil
`form.submit()` saat berubah — **dan** di sebelahnya ada tombol
`Terapkan` yang melakukan hal yang sama.

Di **Laporan** dan **Log audit**: tanggal di dalam chip, tetapi **tidak**
mengirim sendiri, dan tombol `Terapkan` adalah satu-satunya jalan.

Jadi perilaku yang sama (menerapkan saringan) punya dua mekanisme berbeda di
halaman yang bersebelahan. Pengguna tidak bisa menebak apakah mengubah tanggal
langsung berlaku atau harus klik.

**Perbaikan:** satu pola saja — ubah → langsung berlaku (dengan `Applies`
otomatis), hapus semua tombol `Terapkan`.

### S-3. Isian tanggal tidak punya nama yang terbaca pembaca layar

`laporan` (2), `log` (2), `pesanan` (1): `<input type="date" name="from">` hanya
diberi teks visual "Dari" sebagai pembungkus `<label class="chip">`. Tidak ada
`<label for>` yang terhubung, dan `aria-label` tidak ada.

**Perbaikan:** `<label for="log-dari">` eksplisit, atau `aria-label`.

### S-4. Dua skala radius dan tiga skala tombol

- Radius: token `--radius-s/m/l` (10/16/26 px) **plus** nilai lepas `0.8125rem`
  (13 px) pada `.btn`, `.chip`, `.toast`, `0.6875rem` (11 px) pada `.btn-mini`.
  Empat nilai, dua sistem.
- Tombol: `.btn` (50 px, penuh), `.btn-mini` (44 px), `.chip` (44 px, bingkai
  tipis). Tiga tinggi berbeda tanpa aturan kapan memakai yang mana.

**Perbaikan:** tentukan satu skala radius 3 langkah dan satu skala tinggi
tombol 2 langkah di `DESIGN.md`, lalu terapkan.

### S-5. Periode Laporan tidak punya pintasan

Laporan meminta dua tanggal manual setiap kali dibuka, padahal pertanyaan yang
paling sering adalah "bulan ini" atau "7 hari terakhir".

**Perbaikan:** chip pintasan (Hari ini / 7 hari / 30 hari / Bulan ini) yang
mengisi kedua tanggal.

---

## Rendah

### R-1. Kartu bersarang: kartu di dalam kartu

`+page.svelte` (blok DOKU mati: `.surface` yang memuat `.hint`), `pengaturan`
(3 `.surface` berurutan sebagai bagian formulir), detail pesanan (13 `.surface`
berturut-turut tanpa pemisah antar bagian).

Bukan pelanggaran keras (detektor tidak menandainya), tetapi membuat halaman
detail pesanan terasa seperti tumpukan kotak, bukan satu dokumen.

**Perbaikan:** untuk formulir panjang, pakai satu kartu dengan `<hr class="divider">`
antar bagian; sisakan kartu untuk satuan yang memang berdiri sendiri.

### R-2. Sepertiga tab bawah memakai ikon "⋯"

Tab **Lainnya** memakai tiga titik, bukan ikon yang menggambarkan isinya
(Pengaturan, Laporan, Log). Ikon titik-titik adalah penanda "menu tak bernama".

### R-3. Teks 11 px di bilah tab

`.tab` memakai `font-size: 0.6875rem` (11 px). Ini batas bawah yang masih
terbaca; di layar 430 px dengan label "Hari ini"/"Pesanan" masih lolos, tetapi
tidak ada ruang untuk teks lebih panjang (mis. "Pengaturan").

### R-4. Latar kertas + kartu putih: dua lapis kontras yang tipis

`--paper #f4ede0` vs `--card #fffdf8` hanya berbeda ~4% luminansi. Kartu
dibedakan terutama oleh **garis tepi** `--sand`, bukan oleh kedalaman. Di layar
redup, kartu dan latar melebur.

Bukan kesalahan (detektor `cream-palette` menyebut latar krem sebagai refleks
"selera AI"), tetapi di sini krem berasal dari warna tanah/kurma yang memang
identitas toko — **dipertahankan**, dengan catatan: jangan menambah lapisan
krem di atas krem (lihat R-1).

---

## Yang sudah benar (jangan diubah)

- **Tipografi berkarakter**: Young Serif untuk judul, Figtree untuk isi. Tidak
  ada `overused-font` (Inter/Roboto/Fraunces dsb).
- **Tidak ada gradien ungu/cyan** (`ai-color-palette`) dan tidak ada teks
  bergradien.
- **Tidak ada `italic-serif-display`** — judul tegak, bukan miring.
- **Tidak ada `pulsing-dot`, `bounce-easing`, `marquee`**, dan gerak dihormati
  lewat `prefers-reduced-motion`.
- **Status terbaca tanpa warna** — lencana memakai bentuk penanda (○ ● ■ ▲ ★ ◇ ✕),
  ini praktik aksesibilitas yang jarang dan bagus.
- **Target sentuh 44–50 px** dan `input` ≥16 px (mencegah zoom iOS) terpenuhi.
- **Kontras teks utama 14,97:1**, `.muted` 4,66:1 — lolos AA.
- **Latar ilustrasi 10%** dan `@media print` yang serius (A4, hitam-putih).

---

## Urutan pengerjaan yang disarankan

1. **T-1, T-3, T-4** — satu sesi, berdampak langsung ke pembaca layar dan
   keterbacaan.
2. **T-2** — hapus aturan global, cek tidak ada yang meluber.
3. **S-1** — pindahkan inline style ke kelas; ini yang membuat perbaikan
   berikutnya murah.
4. **S-2, S-3, S-4** — seragamkan saringan, label, radius/tombol.
5. **S-5, R-1..R-4** — peningkatan.


---

# Hasil perbaikan

Dikerjakan 23 November 2026, satu rangkaian perubahan.

## Angka sebelum → sesudah

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Temuan detektor Impeccable (8 halaman admin) | **2** | **0** |
| Inline `style="…"` di portal admin | **100** | **0** |
| Nilai radius lepas (bukan token) | 4 | **0** |
| Teks redup tanpa token & tanpa fallback | 8 tempat | **0** |
| Aturan CSS global ditulis dari CSS admin | 1 (`html`) | **0** |
| Heading melompat (h1→h3) | 2 halaman | **0** |
| Pemisah gagal kontras (2,19:1) | 1 | **0** (kini 3,91:1) |
| Halaman tanpa `<label for>` pada tanggal | 3 | **0** |
| Pola saringan berbeda | 2 | **1** |

Gates: format ✓ · lint **0** temuan · svelte-check **0/0** · tes **114/114** · build ✓

## Apa yang dikerjakan

### T-1 — Token teks redup
`--redup` dan `--redup-lemah` ditambahkan di `:root`, masing-masing dengan
**fallback heksadesimal lebih dulu**, baru `color-mix()`. Sebelumnya tidak ada
fallback sama sekali di 8 tempat. Kini satu sumber, dan peramban lama tidak
kehilangan hierarki.

### T-2 — Aturan global dihapus
`html { overflow-x: clip }` dihapus dari CSS admin. `scrollbar-gutter: stable`
dipertahankan (itu memang global dengan sengaja). Alasan penghapusan ditulis
sebagai komentar di tempatnya, supaya tidak dikembalikan tanpa berpikir.

### T-3 — Heading
Laporan dan Pengaturan: `<h3>` → `<h2 class="card-title">`. Detail pesanan dan
detail produk juga, karena memakai pola yang sama. Hasil render sekarang:
`1-2-2-2…` di semua halaman, tidak ada lompatan.

### T-4 — Pemisah rantai status
`--ink` 35% → `--redup-lemah` (55%) = **3,91:1**, lolos ambang 3:1.

### S-1 — Akar masalah jarak, bukan gejalanya
Ini bagian yang paling penting dan paling mudah salah.

Percobaan pertama saya adalah membuat 19 kelas utilitas (`.flush`, `.mt-s`,
`.mb-0`, …). Itu **memindahkan** masalah: 100 inline style menjadi 19 kelas
yang harus dihafal. Kelas-kelas itu saya buang.

Yang benar adalah memperbaiki **akar**: `app.css` memberi `h1/h2/h3`
`margin-bottom: 0.5rem` dan `p` `0.75rem`, tanpa mengenal konteks. Di dalam
kartu margin itu selalu harus dinolkan — itulah asal ~50 penimpaan.

Penggantinya aturan aliran, sekali untuk semua kartu:

```css
.admin-scope .surface > :first-child { margin-top: 0; }
.admin-scope .surface > :last-child  { margin-bottom: 0; }
```

Sisanya kelas **bermakna** (bukan utilitas jarak): `.chip-static`,
`.field-inline`, `.input-s/m/xs/grow`, `.check-line`, `.variant-card`,
`.card-title`, `.visually-hidden`. Hasilnya 0 inline style dan CSS yang lebih
pendek daripada sebelumnya.

### S-2 — Satu pola saringan
Sebelumnya: Pesanan memakai auto-submit **dan** tombol Terapkan; Laporan/Log
hanya tombol. Sekarang satu pola di tiga halaman: **ubah isian → tekan
Terapkan**. Auto-submit dihapus seluruhnya.

Alasan memilih pola ini (bukan sebaliknya): bekerja tanpa JavaScript, tidak
memuat ulang halaman setiap kali potongan tanggal dipilih di `<input
type="date">`, dan tidak ada dua mekanisme yang bersaing.

### S-3 — Label tanggal
`<label for="dari">`, `for="sampai"`, `for="kurir"`, `for="tanggal"` — semuanya
terhubung sekarang. `autocomplete` tetap.

### S-4 — Satu skala
Radius: `--radius-s` 10 px · `--radius-m` **12 px** · `--radius-l` 26 px. Tidak
ada nilai keempat. `--radius-m` kini **dipakai** (sebelumnya token mati).

### S-5 — Pintasan periode
Laporan mendapat chip **7 hari / 30 hari / Bulan ini / Semua**. Fungsi
`shortcut()` menghitung tanggal di sisi peramban lalu memakai jalur yang sudah
ada — tidak ada logika baru di server.

### R-1, R-3, R-4
`.variant-card` memisahkan aksi hapus ke kaki kartu dengan garis. `.card-title`
menyeragamkan judul kartu. Pemisah bagian tidak lagi berupa kartu bertumpuk.

`cream-palette` **dipertahankan** sebagai keputusan sadar (warna kurma, bukan
refleks) dan dicatat di `DESIGN.md`.

## Bug yang ditemukan saat perbaikan

**Panah dropdown hilang.** Saat menyatukan gaya isian di dalam chip saya
menulis `background: transparent` (shorthand). Itu ikut menghapus
`background-image` panah milik `select` global — jadi dropdown "Pengiriman"
kehilangan panahnya. Diperbaiki menjadi `background-color: transparent` plus
penyesuaian `background-position`/`background-size` agar panah pas di dalam
chip. Diverifikasi: `background-image` masih ada, HTML `select` utuh.

Ini contoh kenapa "gates hijau" tidak cukup — lint, svelte-check, dan 114 tes
semuanya lulus meski panahnya hilang. Bug ini hanya ketahuan karena saya
membaca ulang CSS hasil sendiri.

## Yang belum dikerjakan (sengaja)

| # | Hal | Alasan |
|---|---|---|
| 1 | `cream-palette` | Warna brand yang disetujui; dipertahankan dengan syarat terdokumentasi |
| 2 | Ikon tab "Lainnya" (`⋯`) | Butuh keputusan desain, bukan perbaikan teknis — sebaiknya Anda yang memilih |
| 3 | Penggabungan kartu di detail pesanan | 13 kartu berurutan masih banyak, tetapi tiap bagian memang berdiri sendiri; menggabungkan butuh uji cetak ulang |
