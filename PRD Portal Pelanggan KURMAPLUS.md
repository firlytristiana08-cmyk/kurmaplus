# PRD Portal Pelanggan KURMAPLUS

Nov 14, 2026 · @Oceana Luma

## Ringkasan dan tujuan

Portal pelanggan KURMAPLUS adalah toko online mobile-first (PWA) untuk menjual tiga kurma, yaitu sukari, ajwa, dan tunisia, dengan pembayaran lewat DOKU dan pengiriman hanya Sabtu dan Minggu di Jabodetabek lewat Grab atau Gojek dengan ongkir dibayar pembeli. Dokumen ini hanya mencakup portal pelanggan; portal admin dibuat di PRD terpisah.

Tujuan versi 1:

- Pembeli bisa memesan dan membayar dari HP dalam waktu singkat, tanpa membuat akun.
- Biaya sistem 0 rupiah di luar potongan transaksi DOKU dan domain yang bersifat opsional.
- Pembeli memilih kurir Grab atau Gojek dan paham sejak checkout bahwa ongkir dibayar pemesan di luar total pesanan.
- Status bayar berubah otomatis, tanpa pemilik mengecek mutasi rekening satu per satu.

## Pengguna dan skenario

Pembeli membuka link toko dari WhatsApp, Instagram, atau teman, hampir selalu di HP. Mereka belum mengenal pemilik, jadi harga, ukuran, ongkir, dan jadwal kirim harus terlihat tanpa perlu bertanya.

| Pembeli | Kebutuhan | Yang menentukan jadi beli |
| --- | --- | --- |
| Pembeli di sekitar Cibubur | Kurma 500 gr atau 1 kg untuk keluarga | Info ongkir kurir jelas sebelum bayar |
| Pembeli Jabodetabek lain | Kurma untuk hampers atau tamu | Info ongkir dan tanggal kirim jelas sebelum bayar |
| Pembeli partai besar | Kemasan 3 kg atau 5 kg untuk acara atau dijual lagi | Harga kemasan besar dan stok yang pasti |

Skenario utama:

1. Pembeli membuka halaman kurma sukari, memilih 1 kg, menandai lokasi, memilih Grab atau Gojek, membaca info bahwa ongkir dibayar pemesan, memilih hari Sabtu, membayar, dan melihat halaman pesanan.
2. Pembeli mengganti pilihan kurir dari Grab ke Gojek, dan total pesanan tidak berubah karena ongkir tidak masuk di dalamnya.
3. Pembeli tidak membayar dalam batas waktu, pesanan kedaluwarsa, dan stok kembali otomatis.
4. Pembeli menutup halaman setelah bayar, lalu mengecek pesanan di halaman lacak dengan kode pesanan dan 4 digit terakhir nomor WhatsApp.

## Ruang lingkup

Versi 1 hanya memuat yang dibutuhkan untuk menerima pesanan dan pembayaran pertama.

**Masuk versi 1**

- Katalog 3 produk (sukari, ajwa, tunisia) dengan 9 varian ukuran, masing-masing punya harga dan stok sendiri.
- Keranjang, checkout tanpa akun, dan penandaan lokasi di peta.
- Pilihan kurir Grab atau Gojek dengan info singkat bahwa ongkir dibayar pemesan, serta pilihan tanggal kirim Sabtu atau Minggu.
- Pembayaran lewat DOKU Checkout, status bayar otomatis.
- Halaman status pesanan dan halaman lacak.
- PWA yang bisa dipasang di layar utama HP.
- Tombol chat WhatsApp ke pemilik dengan pesan yang sudah terisi.

**Sengaja ditunda**

- Akun pembeli dan login, voucher dan diskon, ulasan produk.
- Notifikasi push dan WhatsApp otomatis (WhatsApp API berbayar).
- Perhitungan dan tampilan tarif ongkir di toko, kurir lain, ambil di tempat, dan pengiriman di luar Jabodetabek.
- Bayar di tempat (COD) dan bahasa selain Indonesia.

**Ketergantungan pada portal admin.** Portal admin dibuat setelah portal ini, sehingga data awal (produk, harga, stok, pengaturan ongkir dan jadwal) dimasukkan lewat berkas seed dan perintah SQL Supabase (`supabase db push` atau SQL Editor). Skema data di bagian Model data sudah disiapkan agar admin nanti langsung memakai tabel yang sama.

## Aturan bisnis

Semua nilai di kolom kanan disimpan sebagai pengaturan, bukan ditulis mati di kode, sehingga bisa diubah pemilik tanpa menunggu pembaruan aplikasi. Nilai yang bertanda (belum ditentukan) harus diisi pemilik sebelum rilis.

| Kode | Aturan | Nilai awal |
| --- | --- | --- |
| BR-01 | Pengiriman hanya hari Sabtu dan Minggu, dihitung dalam zona waktu Asia/Jakarta | Sabtu, Minggu |
| BR-02 | Pesanan yang dibuat sebelum batas pesan masuk jadwal akhir pekan itu, setelahnya masuk akhir pekan berikutnya | Kamis 23.59 (usulan) |
| BR-03 | Pembeli memilih satu tanggal kirim dari tanggal Sabtu atau Minggu yang masih tersedia | 2 tanggal terdekat |
| BR-04 | Setiap tanggal kirim punya batas jumlah pesanan, tanggal yang penuh tidak bisa dipilih | (belum ditentukan) |
| BR-05 | Area layanan hanya Jabodetabek: pembeli memilih kota atau kabupaten dari daftar dan titik peta harus berada dalam batas koordinat Jabodetabek | Daftar kota/kabupaten Jabodetabek |
| BR-06 | Titik peta pembeli disimpan sebagai tujuan kurir, tanpa perhitungan jarak atau tarif | Titik peta wajib |
| BR-07 | Pembeli memilih satu kurir, Grab atau Gojek. Tidak ada kurir lain, pengiriman sendiri oleh pemilik, atau ambil di tempat | Grab, Gojek |
| BR-08 | Ongkir kurir dibayar oleh pemesan dan tidak termasuk total pesanan di DOKU. Toko tidak menghitung atau menampilkan tarif. Tidak ada gratis ongkir | Info singkat di checkout dan halaman pesanan |
| BR-09 | Pemilik memesan kurir lewat aplikasi pilihan pembeli untuk tanggal kirim, dan cara pemesan membayar ongkirnya mengikuti kebijakan pemilik | (cara bayar ongkir belum ditentukan) |
| BR-10 | Total = subtotal, dalam rupiah bulat, tanpa ongkir dan tanpa baris pajak | Rp, bilangan bulat |
| BR-11 | Stok dikelola per varian, dikunci saat pesanan dibuat dan dikembalikan jika pesanan kedaluwarsa atau gagal | Dikunci saat order dibuat |
| BR-12 | Pesanan yang belum dibayar kedaluwarsa setelah batas waktu bayar | 60 menit |
| BR-13 | Satu pesanan dibayar penuh di muka lewat DOKU, tanpa cicilan dan tanpa COD | DOKU Checkout |
| BR-14 | Pembeli tidak membatalkan sendiri setelah bayar, perubahan atau komplain ditangani pemilik lewat WhatsApp | Manual |

## Halaman dan alur

Enam halaman utama, semuanya dirancang untuk layar HP lebih dulu. Setiap produk punya alamat sendiri supaya mudah dibagikan lewat WhatsApp.

| Alamat | Fungsi | Isi utama |
| --- | --- | --- |
| / | Katalog | 3 produk, ringkasan jadwal kirim dan kurir Grab atau Gojek |
| /kurma/\[slug\] | Detail produk | Foto asli, deskripsi, pilihan ukuran, jumlah, stok, tombol tambah ke keranjang |
| /keranjang | Keranjang | Daftar item, ubah jumlah, subtotal |
| /checkout | Checkout satu halaman | Kontak, lokasi di peta, pilihan kurir, tanggal kirim, ringkasan biaya, tombol bayar |
| /pesanan/\[kode\] | Status pesanan | Status, ringkasan, tanggal kirim, tombol chat WhatsApp |
| /lacak | Lacak pesanan | Kode pesanan dan 4 digit terakhir nomor WhatsApp |

Halaman pendukung: /info (cara pesan, jadwal, ongkir, kontak), /privasi, halaman 404, dan halaman offline.

Alur pembelian:

1. Pembeli memilih produk dan ukuran, lalu menambahkannya ke keranjang.
2. Di checkout, pembeli mengisi nama, nomor WhatsApp, alamat, kota atau kabupaten, dan patokan.
3. Pembeli menandai titik di peta, lewat tombol lokasi saya atau dengan menggeser pin. Titik ini menjadi tujuan kurir.
4. Pembeli memilih kurir (Grab atau Gojek) dan tanggal kirim. Di bawahnya ada info singkat, misalnya: Ongkir Grab atau Gojek dibayar pemesan, tidak termasuk total ini.
5. Tombol bayar membuat pesanan, mengunci stok, dan mengarahkan pembeli ke halaman pembayaran DOKU.
6. Setelah bayar, pembeli kembali ke halaman status pesanan yang menampilkan status terkini.

Status pesanan yang terlihat pembeli: menunggu bayar, dibayar, dikemas, dikirim, selesai, dan kedaluwarsa. Perubahan setelah dibayar dilakukan pemilik dari portal admin.

## Kebutuhan fungsional

Setiap baris punya kriteria penerimaan yang bisa diuji. Tugas pembangunan merujuk ke kode FR dan BR.

| Kode | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| FR-01 | Katalog menampilkan 3 produk dengan foto, nama, dan harga mulai dari | Data dibaca dari database, varian yang stoknya 0 tampil sebagai Habis |
| FR-02 | Halaman produk punya pilihan ukuran dan jumlah | Harga berubah sesuai ukuran, jumlah tidak bisa melebihi stok |
| FR-03 | Keranjang tersimpan di perangkat dan divalidasi ulang oleh server saat checkout | Harga dan stok yang dipakai selalu dari server, perbedaan ditampilkan ke pembeli |
| FR-04 | Pembeli mengisi nama, WhatsApp, alamat, kota atau kabupaten, patokan, dan catatan opsional | Nomor 08... dan +62... disimpan seragam sebagai 62..., kolom wajib ditandai jelas |
| FR-05 | Pembeli menandai lokasi di peta | Ada tombol lokasi saya, pin bisa digeser, checkout tidak bisa dilanjutkan tanpa pin |
| FR-06 | Pembeli memilih kurir Grab atau Gojek dan melihat info bahwa ongkir dibayar pemesan | Info singkat terlihat di checkout dan halaman pesanan, tidak ada tarif atau angka ongkir, titik di luar area layanan ditolak dengan pesan yang jelas |
| FR-07 | Pembeli memilih tanggal kirim | Hanya Sabtu dan Minggu yang sah menurut BR-02, tanggal penuh tidak bisa dipilih |
| FR-08 | Ringkasan biaya tampil sebelum bayar | Subtotal, total, kurir, dan tanggal kirim terlihat bersama, dengan catatan ongkir dibayar pemesan |
| FR-09 | Tombol bayar membuat pesanan dan mengunci stok dalam satu transaksi database | Jika stok kurang, pesanan tidak dibuat dan keranjang diperbarui dengan pesan yang jelas |
| FR-10 | Pembuatan pesanan dilindungi dari spam | Proteksi CAPTCHA Supabase lolos dan jumlah pesanan per IP dibatasi |
| FR-11 | Sistem membuat sesi DOKU Checkout dan mengarahkan pembeli ke halaman bayar | Nomor invoice DOKU sama dengan kode pesanan, tautan bayar disimpan |
| FR-12 | Sistem menerima notifikasi DOKU | Signature diverifikasi, status berubah sekali walau notifikasi datang berulang, balasan 200 segera |
| FR-13 | Pesanan kedaluwarsa otomatis | Pesanan menunggu bayar yang melewati batas waktu menjadi kedaluwarsa dan stoknya kembali dalam 5 menit |
| FR-14 | Halaman status tetap benar jika notifikasi terlambat | Jika masih menunggu bayar, sistem menanyakan status ke DOKU sebelum menampilkan |
| FR-15 | Halaman lacak mencari pesanan | Hanya cocok jika kode pesanan dan 4 digit terakhir WhatsApp benar |
| FR-16 | Tombol chat WhatsApp ke pemilik | Pesan terisi kode pesanan dan nama pembeli |
| FR-17 | Aplikasi bisa dipasang sebagai PWA | Ada manifest dan ikon, katalog dan halaman info terbuka tanpa internet, checkout menampilkan pesan jelas saat offline |

## Model data

Database Supabase (Postgres). Uang disimpan sebagai bilangan bulat rupiah, waktu disimpan UTC dan ditampilkan dalam Asia/Jakarta. Portal admin nanti memakai tabel yang sama.

| Tabel | Kolom penting | Catatan |
| --- | --- | --- |
| products | id, slug, name, description, photo, sort\_order, is\_active | 3 baris awal |
| variants | id, product\_id, label, weight\_grams, price\_idr, stock, is\_active | 9 baris awal, stok per varian |
| orders | id, code, status, customer\_name, customer\_phone, address, city, lat, lng, courier, delivery\_date, subtotal\_idr, total\_idr, note, created\_at, expires\_at, paid\_at | Kode pesanan acak 8 karakter, tidak berurutan |
| order\_items | order\_id, variant\_id, name\_snapshot, price\_snapshot, qty | Nama dan harga disalin agar riwayat tidak berubah saat harga diubah |
| payments | id, order\_id, invoice\_number, checkout\_url, status, created\_at | Satu pesanan boleh punya lebih dari satu sesi bayar |
| webhook\_events | request\_id (unik), received\_at | Mencegah notifikasi ganda diproses dua kali |
| settings | key, value | Batas pesan, batas waktu bayar, kapasitas harian, batas koordinat area layanan |

Status pesanan: `pending_payment`, `paid`, `packed`, `shipped`, `done`, `expired`, `cancelled`. Perubahan status hanya maju sesuai aturan, dan pesanan yang sudah dibayar tidak pernah kembali menjadi kedaluwarsa.

Data pribadi (nama, WhatsApp, alamat, koordinat) hanya diambil untuk pengiriman. Halaman lacak dan status tidak pernah menampilkan alamat lengkap pembeli ke orang lain, dan koordinat titik asal toko tidak ditampilkan ke publik.

## Integrasi DOKU

Portal memakai DOKU Checkout: pembeli membayar di halaman milik DOKU, sehingga data kartu atau rekening tidak pernah lewat sistem kita.

**Alur**

1. Server membuat sesi Checkout ke DOKU. Alamat dasar sandbox `https://api-sandbox.doku.com` dan production `https://api.doku.com`. Isi permintaan: nominal total, nomor invoice (sama dengan kode pesanan), batas waktu bayar dalam menit, data pembeli, dan alamat kembali ke halaman status.
2. Setiap permintaan ditandatangani dengan header Client-Id, Request-Id, Request-Timestamp, dan Signature. Signature dibuat dari Digest (SHA-256 dari isi permintaan, dikodekan base64) dan HMAC-SHA256 memakai Secret Key, dengan awalan HMACSHA256=. Rumus lengkap dan jalur endpoint dikonfirmasi lagi di dokumentasi DOKU sebelum mulai menulis kode.
3. DOKU membalas dengan alamat halaman bayar. Server menyimpannya di tabel payments lalu mengarahkan pembeli ke sana.
4. Setelah pembeli membayar, DOKU mengirim notifikasi HTTP ke alamat notifikasi yang diatur di Back Office. Server memverifikasi Signature notifikasi dengan isi mentah permintaan, membalas 200 segera, lalu memproses.
5. Pesanan menjadi dibayar hanya jika status transaksi SUCCESS. Status FAILED diabaikan karena di Checkout pembeli boleh mengganti metode bayar. Notifikasi yang sama bisa datang berulang, jadi pemrosesan harus aman diulang (tabel webhook\_events).
6. Sebagai cadangan, halaman status menanyakan Check Status API DOKU bila pesanan masih menunggu bayar dan notifikasi belum masuk.

**Keputusan implementasi.** Klien DOKU ditulis sendiri (sekitar 100 baris) memakai Web Crypto bawaan runtime, tanpa paket pihak ketiga. Paket komunitas yang ada masih versi awal dan tidak dikelola DOKU, sedangkan kode ini menyentuh uang.

**Biaya dan syarat akun**

- Tidak ada biaya pendaftaran atau bulanan, biaya hanya dipotong dari transaksi yang berhasil.
- Tarif yang tercantum di halaman harga DOKU saat riset: virtual account Rp4.000 per transaksi, QRIS 0,7%, kartu 2,8% + Rp2.000. Biaya selain QRIS belum termasuk PPN 11%. Angka pasti untuk akun Anda dicek di menu Fee Scheme dashboard DOKU.
- Usaha perorangan boleh mendaftar. Data yang diminta: KTP, foto selfie dengan KTP, dan foto bukti usaha (lokasi, kegiatan, atau produk). NIB tidak disebut sebagai syarat untuk akun perorangan.
- Virtual Account, Alfa Group, Indomaret, DOKU e-Wallet, dan Akulaku langsung aktif setelah akun bisnis dibuat. QRIS harus diaktifkan di dashboard, jadi jangan dijanjikan ke pembeli sebelum aktif.

**Dari sandbox ke live.** Bangun dan uji penuh di sandbox memakai DOKU Payment Simulator. Kunci sandbox dan live disimpan sebagai secret Supabase yang berbeda, dan peralihan ke live hanya mengganti secret, alamat dasar, dan alamat notifikasi.

## Tumpukan teknologi dan library

Semua pilihan punya paket gratis yang cukup untuk satu toko kecil. Untuk database Supabase paket gratis memberi 500 MB basis data per proyek dan 5 GB egress per bulan, jauh di atas kebutuhan awal. Basis data gratis dapat dijeda bila proyek tidak aktif, jadi aplikasi dan pemantauan disiapkan agar proyek tetap terpakai, dan query tetap dibuat hemat sejak awal. Versi library yang dipakai adalah rilis stabil terbaru saat proyek dimulai.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Hosting | Vercel (atau host Node lain) lewat @sveltejs/adapter-node | Gratis untuk toko kecil, pratinjau otomatis tiap perubahan, dan cocok dipasangkan dengan Supabase |
| Framework | SvelteKit 2, Svelte 5, TypeScript strict | Ukuran JS kecil untuk HP lambat, form tetap jalan tanpa JS lewat form actions |
| Database | Supabase (Postgres) | Gratis, SQL penuh, terhubung lewat URL basis data, dan siap dipakai portal admin nanti |
| ORM dan migrasi | Drizzle ORM, drizzle-kit untuk membuat migrasi, `drizzle-kit migrate` atau `supabase db push` untuk menjalankannya | Ringan, kueri bertipe, migrasi berupa SQL yang bisa dibaca |
| Validasi | Valibot | Kecil dan bisa dipakai di server dan klien dengan skema yang sama |
| Styling | Tailwind CSS 4 dengan token desain sendiri lewat @theme | Cepat ditulis, tampilan tetap milik KURMAPLUS karena tanpa kit komponen siap pakai |
| Komponen tanpa gaya | Bits UI (hanya dialog, bottom sheet, radio group) | Aksesibilitas keyboard dan pembaca layar sudah benar, gayanya kita tulis sendiri |
| Peta | Leaflet dengan tile OpenStreetMap dan atribusi, dimuat hanya di halaman checkout | Gratis dan ringan. Bila lalu lintas membesar, pindah ke penyedia tile lain |
| PWA | @vite-pwa/sveltekit | Manifest, service worker, dan cache katalog untuk dibuka tanpa internet |
| Gambar | @sveltejs/enhanced-img | Foto produk dibuat dalam beberapa ukuran dan format modern saat build |
| Font | Fontsource, di-host sendiri | Tanpa permintaan ke pihak luar, lebih cepat dan lebih privat |
| Anti-bot | Proteksi CAPTCHA Supabase (hCaptcha) | Gratis, tidak membatasi jumlah verifikasi di paket gratis |
| Pembayaran | Klien DOKU tulisan sendiri dengan Web Crypto | Lihat bagian Integrasi DOKU |
| Tugas terjadwal | Cron Supabase (pg_cron), tiap 5 menit | Mengembalikan stok pesanan kedaluwarsa |
| Tes | Vitest untuk logika, Playwright untuk alur beli | Logika uang, jarak, dan jadwal wajib bertes |
| Kualitas kode | Biome (lint dan format), svelte-check | Satu alat cepat, nol error dan nol peringatan |
| Ikon | SVG inline seperlunya, sumber Lucide | Hanya ikon yang benar-benar dipakai, tanpa emoji |

Sengaja dibuat sendiri tanpa library: format rupiah dan tanggal (Intl bawaan browser, zona Asia/Jakarta), dan penyimpanan keranjang (runes Svelte 5 dan localStorage dengan try/catch).

Sengaja tidak dipakai: kit komponen siap pakai (shadcn-svelte, DaisyUI, Flowbite), pustaka state global, axios (cukup fetch), moment atau lodash, dan layanan pihak ketiga yang menambah biaya (Firebase).

## Arah desain

Konsepnya warung kurma yang jujur: terasa seperti toko kecil yang dikelola orang yang tahu barangnya, bukan template e-commerce. Tiga prinsip menjadi ukuran setiap keputusan desain:

1. **Foto asli.** Semua foto produk dipotret sendiri oleh pemilik dengan cahaya jendela dan latar polos (kertas atau kayu), close-up tekstur, dan ada timbangan atau tangan di bingkai sebagai skala. Tanpa stock foto dan tanpa gambar buatan AI untuk produk.
2. **Informasi konkret.** Asal, tekstur, rasa, ukuran butir, dan cara simpan ditulis dari pemilik. Tanpa klaim kosong seperti terbaik atau premium.
3. **Satu tindakan per layar.** Setiap layar punya satu tombol utama yang jelas.

**Warna.** Hangat dan bertanah, mengikuti warna kurma dan kertas bungkus. Semua pasangan teks dan latar wajib lulus kontras WCAG AA, diperiksa saat implementasi.

| Token | Nilai | Dipakai untuk |
| --- | --- | --- |
| tinta | #241710 | Teks utama |
| kertas | #F4EDE0 | Latar halaman |
| pasir | #E7DAC3 | Permukaan kedua, garis pemisah |
| karamel | #A4511C | Tombol utama, tautan, harga |
| zaitun | #4A5A2B | Status berhasil |
| bata | #9B2C2C | Galat dan peringatan stok |

**Tipografi.** Judul memakai Young Serif, isi memakai Figtree, keduanya di-host sendiri lewat Fontsource. Ukuran dasar 16 px (input tidak boleh lebih kecil agar iOS tidak memperbesar layar), angka harga memakai angka tabular supaya sejajar, panjang baris maksimal sekitar 65 karakter.

**Tata letak dan komponen**

- Rancangan utama 360–430 px, satu kolom. Di desktop konten dipusatkan, lebar maksimum 960 px, checkout dua kolom.
- Target sentuh minimal 48 px. Tombol utama menempel di bawah layar dan menampilkan total harga.
- Pilihan ukuran berupa tombol besar yang menampilkan berat dan harga, bukan dropdown.
- Kartu produk berupa foto selebar layar dengan teks di bawahnya. Tidak ada grid kartu dengan ikon.
- Pemisah berupa garis tipis, bukan bayangan berlapis. Sudut membulat konsisten.
- Logo berupa wordmark tipografis KURMAPLUS, dengan tanda plus berwarna karamel.
- Gerak hanya yang fungsional, di bawah 200 ms, dan mengikuti pengaturan prefers-reduced-motion.

**Yang dilarang** (daftar ini dipakai saat meninjau hasil, termasuk hasil dari AI):

- Gradien ungu atau biru, glassmorphism, bentuk blob, efek glow.
- Bagian Mengapa memilih kami berisi tiga kartu berikon.
- Emoji sebagai ikon atau penanda daftar.
- Testimoni dan angka palsu (misalnya 1000+ pelanggan), lencana Best Seller tanpa data.
- Teks lorem ipsum atau kalimat iklan generik. Semua teks ditulis dengan data produk yang nyata.
- Ornamen Islami klise (bulan sabit, kubah, lentera) sebagai dekorasi. Kurmanya sendiri sudah menjadi visual utama.
- Animasi hiasan yang tidak membantu pembeli menyelesaikan pesanan.

**Suara tulisan.** Bahasa Indonesia sehari-hari yang sopan, kalimat pendek, kata kerja langsung (Pilih ukuran, Bayar). Angka selalu lengkap dengan satuan.

**Urutan kerja desain.** (1) Kumpulkan foto asli dan teks ketiga produk. (2) Buat tiga layar kunci di lebar 390 px: halaman produk, checkout, dan status pesanan, dalam bentuk HTML dan CSS yang bisa dibuka di HP. (3) Tinjau bersama pemilik. (4) Baru dijadikan komponen. Tidak ada komponen dibuat sebelum tiga layar itu disetujui.

## Standar kode dan aturan vibe coding

Aturan ini berlaku untuk semua kode, termasuk yang dibuat dengan bantuan AI. Tujuannya satu: hasil yang bisa dipercaya karena menyentuh uang dan data pembeli.

1. **PRD ini sumber kebenaran.** Setiap tugas ke AI menyebut kode FR atau BR yang dikerjakan, dan menghasilkan satu hal kecil yang bisa dijalankan.
2. **Logika dulu, tampilan kemudian.** Skema data dan logika murni (harga, jadwal, stok, signature DOKU) ditulis dan dites lebih dulu. Logika uang tidak boleh ada tanpa tes.
3. **Server adalah sumber kebenaran.** Harga, stok, dan jadwal selalu dihitung ulang di server. Klien hanya menampilkan.
4. **Tidak ada yang dianggap selesai sebelum dijalankan.** Perubahan harus dijalankan lewat tes atau dev server, tampilan dicek di lebar 390 px, dan alur bayar dicoba di HP sungguhan.
5. **Dependensi harus beralasan.** Library baru hanya masuk bila alasannya dicatat di berkas DECISIONS.md. Fungsi yang bisa ditulis di bawah 50 baris ditulis sendiri.
6. **Rahasia tidak pernah di kode.** Kunci DOKU dan CAPTCHA hanya ada sebagai secret Supabase atau di .dev.vars yang masuk .gitignore, tidak pernah dikirim ke klien.
7. **Tidak ada sisa pekerjaan.** Build produksi gagal bila masih ada lorem, TODO, console.log, atau data contoh.
8. **Gaya kode.** TypeScript strict tanpa `any`, svelte-check dan Biome nol error nol peringatan. Nama dalam kode memakai bahasa Inggris, teks yang dilihat pembeli memakai bahasa Indonesia, komentar hanya menjelaskan mengapa, bukan apa.
9. **Struktur tetap.** Logika server di `src/lib/server` (db, doku, pricing, schedule, geo), komponen di `src/lib/components`, rute di `src/routes`. File baru di luar struktur ini harus punya alasan.
10. **Tes minimum sebelum rilis.** Vitest untuk harga, jadwal, stok, signature, dan notifikasi ganda. Playwright untuk satu alur beli sukses dan satu alur kedaluwarsa di sandbox DOKU.
11. **Tinjau diff, bukan hanya hasilnya.** Perubahan AI yang menyentuh file di luar tugas ditolak. Commit kecil dengan pesan jelas, dan setiap perubahan dicoba di pratinjau Vercel sebelum digabung.

## Kebutuhan non-fungsional

| Aspek | Target |
| --- | --- |
| Performa | Skor Lighthouse mobile performance minimal 90, LCP di bawah 2,5 detik pada simulasi 4G, JS awal halaman katalog di bawah 100 KB terkompresi |
| Keamanan | HTTPS saja, signature DOKU diverifikasi, semua input divalidasi skema, CAPTCHA dan pembatasan per IP pada pembuatan pesanan, Content-Security-Policy ketat, tidak ada data kartu atau rekening di sistem |
| Data pribadi | Nama, WhatsApp, alamat, dan koordinat hanya untuk pengiriman, ada halaman kebijakan privasi sesuai UU Pelindungan Data Pribadi, dan data pesanan lama dianonimkan setelah masa simpan yang ditentukan pemilik |
| Aksesibilitas | WCAG 2.2 AA: kontras, fokus terlihat, label pada setiap kolom form, target sentuh minimal 48 px, peta punya alternatif lewat tombol lokasi saya dan kolom alamat |
| PWA | Manifest, ikon 192 dan 512 px (termasuk maskable), service worker menyimpan katalog dan halaman info, ada pesan saat versi baru siap dipakai |
| Kompatibilitas | Chrome Android dan Safari iOS 16.4 ke atas, serta browser desktop terbaru |
| Bahasa dan format | Bahasa Indonesia, rupiah dengan pemisah ribuan titik, tanggal dalam format Indonesia dan zona Asia/Jakarta |
| Biaya | Rp0 per bulan untuk sistem. Pemakaian database dipantau di dashboard Supabase, dan bila mendekati batas paket gratis menjelang musim ramai, pilihan naik ke paket berbayar dibahas lebih dulu |
