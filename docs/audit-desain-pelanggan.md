# Audit desain Portal Pelanggan

Tanggal: 23 November 2026
Cakupan: 9 halaman yang dilihat pembeli — Beranda (splash), Katalog, Detail
produk, Keranjang, Checkout, Pesanan, Lacak, Cara pesan, Privasi, dan halaman
404.
Metode: sama seperti audit portal admin (`docs/audit-desain-admin.md`) —
detektor Impeccable v4.10.0 terhadap **HTML hasil render**, ditambah hitungan
kontras WCAG manual dan penelusuran kode untuk hal yang tak terlihat mesin.

---

## Ringkasan

Portal pelanggan sudah **lebih rapi daripada portal admin sebelum dirapikan**:
**nol inline style** sejak awal, dan palet yang konsisten.

Detektor hanya menemukan satu hal di sini — latar krem — dan itu **warna brand
yang disengaja**, bukan cacat. Jadi pekerjaan sebenarnya ada di tempat yang
tidak bisa dilihat mesin: **empat bug aksesibilitas**, satu kegagalan kontras,
dan sisa nilai desain yang tidak memakai token.

| Tingkat | Jumlah |
|---|---|
| **Tinggi** | 4 |
| **Sedang** | 3 |
| **Rendah** | 3 |

---

## Tinggi

### T-1. `aria-controls` menunjuk elemen yang tidak ada (Checkout)

Dua tombol akordeon di checkout menulis `aria-controls="acc-body"`, tetapi
tidak ada satu pun elemen dengan `id="acc-body"` di halaman. Isi sebenarnya
memakai `kontak-body` dan `lokasi-body`.

Lebih buruk: panelnya dibungkus `{#if}`, jadi id itu **baru ada setelah
terbuka** — padahal `aria-controls` dibaca saat tertutup.

Pembaca layar mengumumkan "tombol, memperluas, mengendalikan" lalu tidak
menemukan apa pun. Ini kesalahan yang tidak terlihat mata sama sekali.

**Perbaikan:** `aria-controls` diperbaiki ke id yang benar, dan panel diubah
dari `{#if}` menjadi `hidden={!terbuka}` sehingga elemennya selalu ada di DOM
— hubungan aria tetap valid dalam dua keadaan.

### T-2. Tiga dialog tidak memindahkan fokus

`role="dialog" aria-modal="true"` dipasang di tiga tempat:
- foto produk (lightbox),
- "Berhasil dimasukkan ke keranjang",
- status pesanan.

Ketiganya **tidak memindahkan fokus** ke dalam dialog. Akibatnya:
- pembaca layar tetap membacakan halaman di belakang, seolah dialog tidak ada;
- Tab berjalan ke elemen yang secara visual tertutup lapisan gelap;
- saat dialog ditutup, fokus entah di mana.

`aria-modal="true"` di sini **berbohong** kepada teknologi bantu.

**Perbaikan:** aksi `src/lib/focus-dialog.ts` — memindahkan fokus, menjebak
Tab/Shift+Tab, dan mengembalikan fokus ke pemicu. Dipasang di ketiga dialog.
Diuji 7 tes (`focus-dialog.test.ts`), dan tesnya **diverifikasi bisa gagal**
(5 dari 7 merah saat aksinya sengaja dirusak).

### T-3. Status pilihan ukuran tidak terbaca pembaca layar

Tombol pilih ukuran memakai kelas `.selected` — **hanya warna** yang berubah.
Tidak ada `aria-pressed`, tidak ada `role` pilihan. Pembaca layar mengumumkan
tiga tombol identik tanpa tahu mana yang aktif, padahal ukuran wajib dipilih
sebelum membeli.

Ini bertentangan dengan prinsip yang sudah dipegang portal admin ("status
terbaca tanpa warna").

**Perbaikan:** `aria-pressed` per tombol + `aria-labelledby` ke judul
"Pilih ukuran".

### T-4. Tidak ada garis fokus keyboard yang konsisten

Hanya `input`, `.btn`, dan kartu katalog yang punya `:focus-visible`. Tombol
jumlah, tombol hapus, chip, titik galeri, dan tombol tutup foto memakai garis
fokus bawaan peramban yang hampir tak terlihat di atas krem — dan **sama
sekali tidak terlihat** di atas latar gelap lightbox.

**Perbaikan:** satu aturan `:focus-visible` global dengan `:where()` (kekhususan
nol, tidak berkelahi dengan komponen), plus warna kertas di atas latar gelap.

---

## Sedang

### S-1. Kontras ikon "foto belum tersedia" hanya 2,10:1

Kotak placeholder di Katalog dan Detail produk memakai `--ink` 35% di atas
latar `--sand` 55%. Ikon itu **satu-satunya isi kotak**, jadi ia grafis
bermakna: batasnya 3:1, bukan 1,5:1 untuk hiasan.

**Perbaikan:** `--redup-lemah` → **3,65:1**.

### S-2. Modal status pesanan tidak mengunci gulir latar

Saat modal terbuka, halaman di belakangnya masih bisa digulir. Di ponsel ini
membuat latar bergerak di balik lapisan gelap dan posisi gulir acak setelah
ditutup. Lightbox produk **sudah** mengunci (`document.body.style.overflow`),
jadi perilakunya pun tidak seragam.

**Perbaikan:** `$effect` mengunci gulir dan memulihkan nilai sebelumnya.

### S-3. Tombol splash menyalin ulang gaya `.btn`

`.splash-btn` di beranda menduplikasi seluruh gaya `.btn` (radius, bayangan,
keadaan ditekan, cincin fokus) dengan satu nilai berbeda: radius `0.8125rem` —
sisa terakhir nilai radius lepas di portal pelanggan. Dua sumber kebenaran untuk
satu tombol.

**Perbaikan:** memakai `.btn` + kelas tambahan untuk jarak saja.

---

## Rendah

### R-1. Radius kartu produk tidak konsisten

Di katalog, gambar memakai `var(--radius-l) var(--radius-l) 0 0`, sedangkan
placeholder memakai campuran `l l m m`. Kartu induk sudah `overflow: hidden`,
jadi sudutnya toh terklip. Dua nilai untuk satu sudut.

**Perbaikan:** radius diserahkan ke induk (`0` di anak).

### R-2. Nilai teks redup ditulis ulang, sebagian tanpa fallback

`#73685f` + `color-mix(... 62% ...)` muncul di 6 tempat di portal pelanggan,
dengan fallback ada/tidak tergantung berkas.

**Perbaikan:** semua memakai `var(--redup)`.

### R-3. `PageHeader`/`PageFooter` terkunci 430 px

Keduanya memakai `max-width: 430px` hardcoded, sedangkan `.wrap` memakai
variabel yang sama. Bila lebar kolom diubah, header dan isi tidak lagi sejajar.

*(Belum diubah — lihat "Yang belum dikerjakan".)*

---

## Yang sudah benar (jangan diubah)

- **Nol inline style** di seluruh portal pelanggan — sudah begitu sejak awal.
- **Target sentuh 48 px** di mana-mana (tombol jumlah, hapus, chip demo).
- **`input` ≥16 px** → tidak ada zoom otomatis di iOS.
- **Kontras teks utama 14,97:1**, `.muted` 4,66:1, harga `--rust` 6,29:1.
- **Tipografi berkarakter**: Young Serif + Figtree, di-host sendiri.
- **`prefers-reduced-motion`** mematikan semua animasi (termasuk `rise-in` di
  splash).
- **Gambar responsif** dengan `srcset`/`sizes` dan `loading="lazy"` yang benar.
- **Split pembayaran jujur**: ongkir selalu disebut "di luar total ini".

---

## Yang belum dikerjakan (sengaja)

| # | Hal | Alasan |
|---|---|---|
| 1 | `cream-palette` ditandai detektor di 9 halaman | Warna brand (kurma). Sudah dicatat sebagai pengecualian sadar di `DESIGN.md` |
| 2 | `PageHeader`/`PageFooter` masih 430 px hardcoded | Tidak ada gejala hari ini; menyentuhnya berarti mengubah komponen yang dipakai semua halaman. Butuh uji visual lebih dulu |
| 3 | Beranda (splash) diukur piksel-ke-piksel ke mockup | Posisi kartu & ekor dihitung dari latar tiap perangkat; jangan diubah tanpa melihat hasilnya |
