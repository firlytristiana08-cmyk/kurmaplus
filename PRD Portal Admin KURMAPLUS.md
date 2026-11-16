# PRD Portal Admin KURMAPLUS

Nov 16, 2026 · @Oceana Luma

## Ringkasan dan tujuan

Portal admin adalah alat kerja satu orang, yaitu pemilik KURMAPLUS, untuk mengelola pesanan yang masuk dari portal pelanggan: memantau pembayaran, mengemas, memesan kurir Grab atau Gojek, menagih ongkir, dan menjaga stok. Dokumen ini melanjutkan PRD Portal Pelanggan KURMAPLUS dan memakai proyek Supabase dan situs Netlify yang sama, sehingga tidak ada biaya sistem tambahan.

Tujuan versi 1:

- Pemilik melihat dalam satu layar apa yang harus dikerjakan hari ini dan akhir pekan ini.
- Pesanan yang sudah dibayar langsung terlihat dan tidak ada yang terlewat sampai hari kirim.
- Daftar kemas dan daftar antar per tanggal kirim bisa dibuka di HP dan dicetak.
- Karena ongkir dibayar pemesan di luar DOKU, pemilik bisa mencatat dan melacak penagihan ongkir tiap pesanan.
- Harga, stok, dan jadwal toko diubah sendiri tanpa menunggu pembaruan aplikasi.
- Setiap perubahan penting tercatat, supaya selisih stok atau status mudah ditelusuri.

## Pengguna dan skenario

Pengguna tunggal: pemilik toko. Ia bekerja dari HP (di rumah, saat mengemas, saat memesan kurir) dan kadang dari laptop untuk mencetak atau melihat rekap. Tidak ada peran lain di versi 1, tetapi akses dikunci per alamat email sehingga pembantu bisa ditambahkan nanti.

Skenario utama dalam satu minggu:

1. **Pesanan masuk.** Pemilik menerima pemberitahuan bahwa ada pesanan dibayar, membukanya, dan memeriksa alamat serta titik di peta.
2. **Kamis malam, batas pesan.** Pemilik membuka rekap tanggal kirim Sabtu dan Minggu: jumlah pesanan, total kemasan per jenis kurma, dan pesanan per kurir.
3. **Menyiapkan kemasan.** Pemilik mencetak atau membuka daftar kemas, menandai pesanan menjadi dikemas satu per satu.
4. **Hari kirim.** Pemilik memesan Grab atau Gojek sesuai pilihan pembeli, menyalin alamat dan koordinat ke aplikasi kurir, mencatat ongkir yang muncul, lalu menagihnya ke pembeli lewat WhatsApp dengan satu tombol.
5. **Setelah terkirim.** Pemilik menandai pesanan selesai dan mencatat ongkir sudah lunas.
6. **Stok menipis atau ganti harga.** Pemilik mengubah stok atau harga varian, atau menutup toko sementara saat bepergian.
7. **Pembeli komplain.** Pemilik membuka pesanan, melihat riwayatnya, dan membatalkan atau mengubah status dengan alasan yang tercatat.

## Ruang lingkup

**Masuk versi 1**

- Beranda kerja (Hari ini): pesanan perlu tindakan, rekap akhir pekan, stok menipis.
- Daftar pesanan dengan filter dan pencarian, halaman detail, dan perubahan status.
- Rekap pengiriman per tanggal kirim dan kurir, daftar kemas, dan daftar antar yang bisa dicetak.
- Pencatatan ongkir per pesanan: kurir sudah dipesan, nominal ongkir, status penagihan.
- Tombol WhatsApp ke pembeli dengan pesan siap pakai (termasuk penagihan ongkir).
- Pengelolaan produk dan varian: harga, stok, aktif atau nonaktif, penyesuaian stok bercatatan, dan unggah foto produk ke Supabase Storage.
- Pengaturan toko: buka atau tutup, tanggal libur, batas pesan, kapasitas harian, batas waktu bayar, nomor WhatsApp, bunyi info ongkir.
- Pemeriksaan status pembayaran ke DOKU dan penandaan bayar manual dengan alasan.
- Laporan sederhana dan ekspor CSV.
- Log audit semua perubahan penting.
- Pemberitahuan ke pemilik saat ada pesanan dibayar.
- PWA admin yang bisa dipasang di HP.

**Sengaja ditunda**

- Banyak pengguna dan peran, pembuatan produk baru lewat admin (produk ketiga tetap lewat berkas seed).
- Galeri dengan lebih dari satu foto per produk, dan penyuntingan foto di dalam admin.
- Pengembalian dana otomatis, pembuatan pesanan manual untuk penjualan offline, dan integrasi stok dengan toko offline.
- Grafik dan dasbor analitik, WhatsApp otomatis, dan pemesanan kurir lewat API Grab atau Gojek.

## Aturan bisnis

Nama status sama dengan PRD pelanggan: `pending_payment`, `paid`, `packed`, `shipped`, `done`, `expired`, dan `cancelled`.

&#91;embedded content: alur status pesanan · 5 langkah, 2 jalur keluar\]

| Kode | Aturan | Kaitan dengan PRD pelanggan |
| --- | --- | --- |
| BA-01 | Status hanya bergerak maju satu langkah. Salah menandai boleh dikoreksi mundur satu langkah dan tercatat di log audit | BR-11 |
| BA-02 | Pesanan menunggu bayar menjadi kedaluwarsa otomatis oleh sistem, admin tidak membatalkannya. Admin boleh menandai dibayar manual hanya setelah memeriksa dashboard DOKU, dengan alasan wajib | BR-12 |
| BA-03 | Pembatalan hanya dari status dibayar atau dikemas, alasan wajib. Stok dikembalikan secara bawaan dan bisa dimatikan bila barang rusak | BR-11 |
| BA-04 | Pengembalian dana dilakukan pemilik di dashboard DOKU. Admin hanya mencatat bahwa dana sudah dikembalikan, beserta tanggal dan catatan | BR-14 |
| BA-05 | Pesanan yang sudah dikirim tidak bisa dibatalkan. Komplain dicatat di catatan internal pesanan | BR-14 |
| BA-06 | Ongkir tidak masuk total DOKU. Tiap pesanan punya status ongkir sendiri: belum dipesan, kurir dipesan, ongkir ditagih, ongkir lunas. Nominal ongkir diisi pemilik dari aplikasi kurir | BR-08, BR-09 |
| BA-07 | Tanggal kirim pesanan boleh dipindah pemilik hanya ke Sabtu atau Minggu lain, dengan catatan. Pembeli diberi tahu lewat WhatsApp | BR-01, BR-03 |
| BA-08 | Stok diubah lewat penyesuaian bercatatan (selisih dan alasan), bukan dengan menimpa angka, dan tidak boleh negatif. Stok yang terkunci pesanan menunggu bayar ditampilkan terpisah dari stok tersedia | BR-11 |
| BA-09 | Perubahan harga hanya berlaku untuk pesanan baru. Pesanan lama memakai harga yang sudah disalin saat dibuat | Model data pelanggan |
| BA-10 | Toko ditutup: checkout dinonaktifkan dengan pesan, pesanan yang sudah ada tidak berubah. Tanggal libur menghilangkan tanggal itu dari pilihan pembeli | BR-02, BR-03 |
| BA-11 | Perubahan batas pesan atau kapasitas harian hanya berlaku untuk pesanan baru | BR-02, BR-04 |
| BA-12 | Setiap perubahan status, stok, harga, dan pengaturan wajib tercatat di log audit. Log tidak bisa diubah atau dihapus dari admin | Baru |

## Halaman dan alur

Portal admin berada di situs yang sama dengan portal pelanggan, di bawah alamat /admin. Pemilik masuk lewat halaman /admin/masuk dengan email, password, dan kode authenticator dari Supabase Auth (lihat Autentikasi dan keamanan). Di HP, navigasi berupa bilah tab di bawah dengan lima tujuan: Hari ini, Pesanan, Pengiriman, Produk, dan Lainnya (Pengaturan, Laporan, Log).

| Alamat | Fungsi | Isi utama |
| --- | --- | --- |
| /admin | Hari ini | Pesanan yang butuh tindakan, rekap akhir pekan ini, stok menipis, tombol buka atau tutup toko |
| /admin/pesanan | Daftar pesanan | Filter status, tanggal kirim, kurir, status ongkir, pencarian kode, nama, atau nomor WhatsApp |
| /admin/pesanan/\[kode\] | Detail pesanan | Item, data pembeli, alamat dan peta, ubah status, blok ongkir, pembayaran DOKU, catatan internal, riwayat perubahan |
| /admin/pengiriman | Pengiriman | Pilih tanggal kirim, lihat daftar kemas (total per varian) dan daftar antar per kurir dan kota, cetak |
| /admin/produk | Produk dan stok | Tiga produk dengan varian, harga, stok, aktif atau nonaktif, penyesuaian stok, unggah foto |
| /admin/pengaturan | Pengaturan toko | Buka atau tutup, tanggal libur, batas pesan, kapasitas harian, batas waktu bayar, nomor WhatsApp, bunyi info ongkir, templat pesan WhatsApp |
| /admin/laporan | Laporan | Periode, jumlah pesanan, omzet, produk terlaris, ekspor CSV |
| /admin/log | Log audit | Siapa mengubah apa dan kapan, dengan nilai sebelum dan sesudah |

Alur kerja satu akhir pekan:

1. Pemilik membuka Hari ini dan melihat pesanan dibayar yang belum dikemas.
2. Di Pengiriman, pemilik memilih tanggal kirim, mencetak atau membuka daftar kemas, dan menyiapkan barang sesuai total per varian.
3. Tiap pesanan selesai dikemas ditandai dikemas dari daftar yang sama.
4. Pada hari kirim, di detail pesanan pemilik menyalin alamat dan koordinat ke aplikasi Grab atau Gojek, memesan kurir, lalu mencatat kurir sudah dipesan dan nominal ongkirnya.
5. Tombol Tagih ongkir membuka WhatsApp ke pembeli dengan pesan berisi nominal, lalu pemilik menandai ongkir ditagih, dan lunas setelah dibayar.
6. Saat kurir mengambil paket, pesanan ditandai dikirim, dan ditandai selesai setelah pembeli menerimanya.

## Kebutuhan fungsional

Kode AD dipakai pada tugas pembangunan, berdampingan dengan kode FR, BR, dan BA.

| Kode | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| AD-01 | Beranda Hari ini menampilkan pesanan dibayar yang belum dikemas | Urut tanggal kirim terdekat, jumlahnya sama dengan filter di daftar pesanan |
| AD-02 | Rekap akhir pekan untuk Sabtu dan Minggu terdekat | Menghitung pesanan berstatus dibayar atau dikemas, angka sama dengan daftar kemas |
| AD-03 | Peringatan stok menipis | Varian dengan stok tersedia di bawah ambang pengaturan tampil di beranda |
| AD-04 | Tombol buka atau tutup toko di beranda | Berlaku pada checkout pelanggan berikutnya tanpa menunggu pembaruan aplikasi |
| AD-05 | Daftar pesanan dengan filter dan pencarian | Filter status, tanggal kirim, kurir, status ongkir, dan pencarian kode, nama, atau nomor WhatsApp, dimuat per halaman dengan indeks database |
| AD-06 | Detail pesanan menampilkan seluruh data dari portal pelanggan | Item, pembeli, alamat, kota, patokan, catatan, titik peta, tanggal kirim, kurir, total, status, dan riwayat |
| AD-07 | Ubah status pesanan | Hanya langkah yang sah menurut BA-01 sampai BA-05 yang tampil, fungsi database menolak perpindahan lain |
| AD-08 | Salin alamat dan koordinat, dan buka di Google Maps | Satu ketukan, koordinat berformat lintang dan bujur yang bisa ditempel ke aplikasi kurir |
| AD-09 | Blok ongkir pada pesanan | Kurir, nominal ongkir, dan status ongkir empat langkah (BA-06) bisa diubah dan tidak mengubah total pesanan |
| AD-10 | Tombol WhatsApp ke pembeli dengan templat pesan | Membuka wa.me dengan nomor berformat 62 dan teks terisi kode pesanan, nama, dan nominal, untuk konfirmasi, tagih ongkir, dan pindah tanggal |
| AD-11 | Catatan internal per pesanan | Tersimpan, tidak pernah tampil ke pembeli |
| AD-12 | Cek status pembayaran ke DOKU dan tandai bayar manual | Tombol cek memanggil Edge Function yang menanyakan Check Status API DOKU dan menampilkan hasilnya, tanda manual wajib berisi alasan dan tercatat (BA-02) |
| AD-13 | Batalkan pesanan dan catat pengembalian dana | Alasan wajib, pilihan stok kembali atau tidak, tanggal dan catatan pengembalian tersimpan (BA-03, BA-04) |
| AD-14 | Pindah tanggal kirim | Hanya Sabtu atau Minggu, tanggal yang penuh diberi peringatan tetapi masih bisa dipilih pemilik, catatan wajib (BA-07) |
| AD-15 | Daftar kemas per tanggal kirim | Total per varian sama dengan penjumlahan item pesanan dibayar dan dikemas pada tanggal itu |
| AD-16 | Daftar antar per tanggal kirim | Dikelompokkan per kurir lalu per kota atau kabupaten, memuat nama, WhatsApp, alamat, patokan, catatan, status kemas, dan status kurir |
| AD-17 | Cetak daftar kemas dan daftar antar | Lembar gaya cetak ukuran A4 tanpa library tambahan, terbaca hitam putih |
| AD-18 | Ubah harga, deskripsi, status aktif, dan foto produk atau varian | Tidak mengubah pesanan lama (BA-09), harga berupa rupiah bulat, foto dikecilkan di peramban (sisi terpanjang 1600 px, format WebP) sebelum diunggah ke bucket Storage |
| AD-19 | Penyesuaian stok bercatatan | Selisih positif atau negatif dengan alasan, stok tidak bisa negatif, tampil stok tersedia, terkunci, dan riwayat (BA-08) |
| AD-20 | Halaman pengaturan toko | Mengubah semua pengaturan pada tabel settings dengan validasi, dibaca oleh checkout pelanggan |
| AD-21 | Laporan per periode dan ekspor CSV | Jumlah pesanan per status, omzet dari pesanan dibayar sampai selesai tanpa ongkir, penjualan per varian, CSV pesanan bisa diunduh |
| AD-22 | Log audit | Daftar bisa disaring per jenis dan tanggal, tidak ada tombol ubah atau hapus (BA-12) |
| AD-23 | Pemberitahuan ke pemilik saat pesanan menjadi dibayar | Terkirim dalam satu menit, kegagalan kirim tidak menggagalkan pemrosesan pembayaran, beranda tetap menjadi cadangan |
| AD-24 | Admin sebagai PWA | Manifest dan nama sendiri (KURMAPLUS Admin), bisa dipasang, data admin tidak disimpan offline dan halaman menampilkan pesan jelas saat tidak ada internet |

## Model data

Portal admin memakai database Supabase (PostgreSQL) yang sama dengan portal pelanggan. Tabel products, variants, orders, order\_items, payments, webhook\_events, dan settings tidak diganti, hanya ditambah lewat migrasi SQL baru di supabase/migrations, dengan kolom waktu bertipe timestamptz dan id berupa uuid seperti di PRD pelanggan.

**Kolom tambahan pada orders**

| Kolom | Isi |
| --- | --- |
| shipping\_status | not\_booked, booked, billed, atau paid, untuk penagihan ongkir di luar DOKU (BA-06) |
| shipping\_actual\_idr | Nominal ongkir dari aplikasi kurir, boleh kosong, tidak masuk total |
| courier\_booked\_at | Waktu kurir dicatat sudah dipesan |
| internal\_note | Catatan pemilik, tidak tampil ke pembeli |
| packed\_at, shipped\_at, done\_at | Waktu tiap langkah status |
| cancelled\_reason | Alasan pembatalan |
| manual\_paid\_reason | Alasan bila ditandai dibayar manual |
| refund\_noted\_at, refund\_note | Catatan pengembalian dana yang dilakukan di dashboard DOKU |

**Tabel baru**

| Tabel | Kolom penting | Catatan |
| --- | --- | --- |
| stock\_movements | id, variant\_id, delta, reason, order\_id, actor, created\_at | Setiap perubahan stok, termasuk penguncian dan pengembalian otomatis dari portal pelanggan |
| audit\_log | id, actor, entity, entity\_id, action, before\_json, after\_json, created\_at | Hanya boleh ditambah, tidak ada fitur ubah atau hapus |

**Kunci baru pada settings:** store\_open, closed\_dates, shop\_whatsapp, shipping\_info\_text, low\_stock\_threshold, wa\_templates, dan notify\_chat\_id. Token bot pemberitahuan tidak disimpan di database, melainkan sebagai secret Supabase.

**Arti stok.** Kolom stock pada variants adalah stok yang tersedia untuk dijual. Stok terkunci yang ditampilkan di admin dihitung dari item pada pesanan berstatus menunggu bayar.

**Akses data.** Row Level Security aktif di semua tabel, termasuk tabel baru. Pengunjung hanya bisa membaca tampilan katalog dan tampilan public\_settings (store\_open, closed\_dates, shop\_whatsapp, shipping\_info\_text, dan kunci lain yang memang untuk umum). Tabel admin\_users menyimpan email pemilik, dibuat saat setup. Fungsi is\_admin() hanya bernilai benar bila email pengguna ada di admin\_users dan sesinya sudah melewati MFA (aal2). Perubahan data admin tidak ditulis langsung ke tabel, melainkan lewat fungsi SQL admin\_\* yang menulis perubahan dan audit\_log dalam satu transaksi, dan hak tulis langsung ke tabel inti dicabut dari peran authenticated.

**Perubahan kecil yang dibutuhkan di portal pelanggan** agar kedua portal sejalan:

1. Fungsi SQL yang mengunci dan mengembalikan stok, termasuk expire\_orders, juga menulis baris stock\_movements.
2. Checkout membaca store\_open, closed\_dates, dan shipping\_info\_text dari tampilan public\_settings, bukan teks yang tertulis mati.
3. Fungsi expire\_orders yang dijalankan pg\_cron menulis audit\_log dengan pelaku sistem.
4. Setelah Edge Function notifikasi DOKU memproses status sukses dan membalas 200, fungsi yang sama mengirim pemberitahuan ke pemilik (AD-23).
5. Pesanan baru dibuat dengan shipping\_status bernilai not\_booked.

## Autentikasi, keamanan, dan log audit

**Gerbang masuk: Supabase Auth.** Pemilik masuk di /admin/masuk dengan email dan password, lalu memasukkan kode dari aplikasi authenticator (MFA TOTP bawaan Supabase). Pendaftaran umum dimatikan. Satu-satunya akun dibuat pemilik lewat dashboard Supabase, lalu emailnya dimasukkan ke tabel admin\_users. Login memakai email dan password dengan MFA, bukan tautan atau kode lewat email, karena layanan email bawaan Supabase hanya mengirim 2 email per jam dan membatasi alamat penerimanya. Sesi bisa dicabut dari dashboard Supabase.

**Penjagaan ada di database, bukan di halaman.** Situs dihosting statis di Netlify, sehingga kode halaman admin bisa diunduh siapa saja, dan menyembunyikan alamat /admin bukan perlindungan. Yang menjaga data adalah Row Level Security: setiap kebijakan admin memanggil fungsi is\_admin(), yang hanya benar bila email pengguna ada di admin\_users dan sesinya sudah melewati MFA (aal2). Tanpa itu, permintaan ke tabel atau fungsi admin ditolak oleh database.

**Mengapa tidak membuat login sendiri.** Penyimpanan dan pemeriksaan password dikerjakan oleh Supabase Auth, bukan oleh kode kita, sehingga tidak ada kode kata sandi buatan sendiri yang perlu dijaga dan diuji.

**Perlindungan tambahan**

- Perubahan data admin tidak ditulis langsung ke tabel. Semuanya lewat fungsi SQL admin\_\* yang memeriksa is\_admin(), memvalidasi perpindahan, dan menulis perubahan serta audit\_log dalam satu transaksi.
- Aksi yang butuh rahasia, seperti cek status ke DOKU, berjalan di Edge Function yang memeriksa JWT pemilik dan is\_admin() sebelum memakai kunci DOKU.
- Kunci service role dan kunci DOKU hanya ada sebagai secret Supabase dan tidak pernah di kode halaman. Halaman admin hanya memakai kunci publishable bersama sesi pemilik.
- Aksi yang sulit dibatalkan (tandai bayar manual, batalkan pesanan, kembalikan stok) meminta konfirmasi di dialog sebelum dijalankan.
- Header Netlify untuk /admin/\* mengirim Cache-Control no-store, tanda noindex, dan Content-Security-Policy ketat. Tidak ada tautan dari portal pelanggan, dan service worker admin tidak menyimpan respons data.
- Ekspor CSV memuat data pribadi pembeli. Tombolnya diberi peringatan, file dibuat langsung di peramban dan tidak diunggah ke mana pun, dan setiap ekspor tercatat di log audit.

**Pemberitahuan ke pemilik.** Edge Function penerima notifikasi DOKU mengirim pesan lewat bot Telegram (gratis, satu panggilan fetch) setelah status pesanan menjadi dibayar. Isi pesan hanya kode pesanan, jumlah item, dan tanggal kirim, tanpa nama, nomor WhatsApp, atau alamat, supaya data pribadi tidak lewat pihak ketiga. Kegagalan kirim tidak menggagalkan pemrosesan pembayaran, dan token bot disimpan sebagai secret Supabase. Pilihan lain ada di pertanyaan terbuka.

**Log audit.** Mencatat pelaku, objek, aksi, serta nilai sebelum dan sesudah untuk: perubahan status dan status ongkir, penandaan bayar manual, pembatalan, penyesuaian stok, perubahan harga, perubahan pengaturan, dan ekspor CSV. Aksi otomatis (kedaluwarsa pesanan, notifikasi DOKU) dicatat dengan pelaku sistem. Log hanya bisa ditambah dan disimpan minimal 24 bulan.

## Tumpukan teknologi dan library

Seluruh tumpukan PRD pelanggan dipakai ulang tanpa diganti: situs statis SvelteKit 2 dengan Svelte 5 dan TypeScript strict di Netlify, Supabase (PostgreSQL, Auth, Storage, Edge Functions, pg\_cron), Valibot, Tailwind CSS 4 dengan token yang sama, Bits UI, Biome, Vitest, deno test, pgTAP, dan Playwright. Admin hanya menambahkan yang berikut.

| Kebutuhan | Pilihan | Alasan |
| --- | --- | --- |
| Letak kode | Grup rute `src/routes/admin` dengan layout sendiri, satu situs statis dan satu proyek Supabase dengan portal pelanggan | Satu database, satu biaya, tidak ada layanan baru |
| Gerbang masuk | Supabase Auth (email, password, dan MFA TOTP) | Pendaftaran umum dimatikan, lihat bagian Autentikasi |
| Klien data admin | @supabase/supabase-js (sudah ada di PRD pelanggan) | Tanpa dependensi baru, sesi pemilik ikut di setiap permintaan sehingga RLS yang memutuskan akses |
| Pemberitahuan | Telegram Bot API dari Edge Function notifikasi DOKU | Gratis, satu panggilan HTTP, tanpa library |
| Tabel dan filter | Parameter URL yang diterjemahkan menjadi filter kueri Supabase | Filter bisa dibagikan atau di-bookmark, tanpa library tabel |
| Cetak | CSS @media print | Daftar kemas dan daftar antar tanpa library PDF |
| Ekspor CSV | Fungsi kecil buatan sendiri dengan BOM UTF-8 dan penanganan tanda kutip | Terbuka benar di Excel dan Google Sheets |
| Salin alamat dan koordinat | navigator.clipboard | Bawaan peramban |
| Lokasi pembeli | Koordinat dan tautan Buka di Google Maps, tanpa memuat peta | Menghemat ukuran halaman dan pemakaian tile gratis |
| Penulisan atomik | Fungsi SQL admin\_\* (plpgsql) dengan tes pgTAP | Perubahan data dan baris audit\_log tersimpan bersama atau tidak sama sekali |
| PWA | @vite-pwa/sveltekit dengan manifest kedua untuk /admin | Nama dan ikon terpisah, tanpa cache data admin |

Indeks database yang wajib dibuat agar kueri admin tetap cepat dan hemat: orders(status, delivery\_date), orders(code), orders(customer\_phone), stock\_movements(variant\_id, created\_at), dan audit\_log(created\_at).

Foto produk diunggah ke bucket Storage yang sama dengan portal pelanggan lewat kebijakan Storage khusus admin (is\_admin()), dikecilkan lebih dulu di peramban dengan canvas bawaan tanpa library tambahan. Paket gratis Supabase memberi 1 GB penyimpanan file dengan batas 50 MB per berkas, jauh di atas kebutuhan tiga produk.

Sengaja tidak dipakai: library tabel atau data grid, library grafik (laporan versi 1 berupa tabel angka), library PDF, dan kit komponen dasbor siap pakai.

## Arah desain

Admin adalah alat kerja, bukan etalase. Ukurannya cepat dipakai dengan satu tangan di HP saat mengemas: jelas, padat, dan tidak menghias. Token warna, font, dan sudut sama dengan portal pelanggan (tinta, kertas, pasir, karamel, zaitun, bata; Young Serif hanya untuk judul halaman, Figtree untuk selebihnya), supaya keduanya terasa satu toko.

**Prinsip**

1. **Layar menjawab satu pertanyaan.** Beranda menjawab apa yang harus dikerjakan sekarang, Pengiriman menjawab apa yang harus dikemas dan diantar pada tanggal tertentu, Detail pesanan menjawab apa langkah berikut untuk satu pesanan.
2. **Daftar tindakan, bukan dasbor.** Beranda berupa daftar kerja berurutan dengan kalimat konkret (misalnya pesanan, tanggal kirim, dan kurir), bukan kumpulan kartu angka.
3. **Satu tombol utama per layar,** menempel di bawah dan dalam jangkauan ibu jari. Aksi berisiko (batalkan, tandai bayar manual) memakai warna bata dan dialog konfirmasi.
4. **Status terbaca tanpa warna.** Setiap status berupa teks dengan bentuk penanda, warna hanya penguat.
5. **Tabel di HP menjadi daftar baris,** tiap baris dua tingkat informasi dan tinggi minimal 56 px. Di laptop barisnya boleh lebih padat.
6. **Keadaan kosong ditulis konkret** (misalnya: Belum ada pesanan dibayar untuk Sabtu ini), tanpa ilustrasi.

**Yang dilarang** (dipakai saat meninjau hasil, termasuk hasil AI):

- Kartu statistik besar berikon, sparkline, dan grafik donat tanpa keputusan yang bisa diambil darinya.
- Sidebar gelap ala template admin, gradien, bayangan berlapis, dan efek kaca.
- Sapaan seperti Selamat datang kembali, avatar, dan ilustrasi kosong generik.
- Warna sebagai satu-satunya pembeda status.
- Data contoh atau angka karangan di build produksi.
- Animasi yang tidak menjelaskan perubahan.

**Cetak.** Daftar kemas dan daftar antar dicetak hitam putih di A4, font isi saja, huruf cukup besar untuk dibaca sambil bekerja, dan tanpa elemen navigasi.

**Urutan kerja desain.** Tiga layar kunci dibuat dulu di lebar 390 px sebagai HTML dan CSS yang bisa dibuka di HP: Hari ini, Detail pesanan, dan Pengiriman (daftar kemas dan antar). Setelah disetujui pemilik, baru dijadikan komponen.

## Standar kode dan aturan vibe coding

Semua aturan pada bagian Standar kode di PRD Portal Pelanggan berlaku sama untuk admin: PRD sebagai sumber kebenaran, logika sebelum tampilan, server sebagai sumber kebenaran, dijalankan sebelum dianggap selesai, dependensi beralasan, tanpa sisa pekerjaan, TypeScript strict, dan diff ditinjau. Aturan tambahan khusus admin:

1. **Perpindahan status adalah fungsi SQL** dengan tes pgTAP untuk setiap pasangan status asal dan tujuan, sah maupun tidak sah.
2. **Satu pintu penulisan.** Semua aksi tulis admin lewat fungsi SQL admin\_\* di supabase/migrations yang menulis perubahan dan audit\_log dalam satu transaksi. Halaman tidak menulis langsung ke tabel inti, hak tulis langsung dicabut dari peran authenticated, dan tes pgTAP memastikannya.
3. **Tes akses wajib.** Tes pgTAP membuktikan bahwa peran anon, pengguna masuk yang bukan admin, dan admin tanpa MFA (aal1) tidak bisa membaca atau menulis tabel dan fungsi admin, sedangkan admin dengan MFA (aal2) bisa.
4. **Invarian stok dan uang diuji.** Stok tidak pernah negatif, jumlah baris stock\_movements selalu menjelaskan perubahan stok, dan admin tidak menghitung ulang total pesanan, melainkan membaca yang tersimpan.
5. **Tes alur admin dengan Playwright.** Satu alur dari dibayar sampai selesai termasuk catatan ongkir, satu pembatalan dengan stok kembali, dan satu penyesuaian stok. Alur dijalankan terhadap Supabase lokal (supabase start) dengan pengguna admin tes dan MFA tes yang tidak pernah ada di produksi.
6. **Tidak ada data pribadi di log aplikasi** (termasuk console) dan di pesan pemberitahuan.
7. **Aksi yang sulit dibatalkan** selalu lewat dialog konfirmasi, dan tombolnya tidak aktif ganda saat sedang diproses.

## Kebutuhan non-fungsional

| Aspek | Target |
| --- | --- |
| Performa | Beranda dan daftar pesanan terbuka di bawah 2 detik pada 4G biasa, JS awal halaman admin di bawah 100 KB terkompresi, bacaan database hemat dengan indeks dan pemuatan per halaman |
| Keamanan | Seluruh isi bagian Autentikasi dan keamanan, termasuk RLS dengan MFA (aal2) pada semua tabel dan fungsi admin, no-store dan noindex lewat header Netlify, dan secret hanya di Supabase |
| Integritas data | Aksi tulis atomik bersama audit\_log, stok tidak negatif, perpindahan status divalidasi di fungsi database |
| Aksesibilitas | WCAG 2.2 AA, target sentuh minimal 48 px, status tidak bergantung pada warna, fokus terlihat, dialog konfirmasi bisa dipakai dengan keyboard |
| Perangkat | Utama HP Android dan iOS 16.4 ke atas yang memasang PWA, tambahan laptop untuk cetak dan laporan |
| Ketersediaan | Mengikuti paket gratis Supabase dan Netlify, termasuk jeda proyek Supabase setelah 7 hari tanpa aktivitas yang ditangani pemeriksaan mingguan di PRD pelanggan. Bila admin tidak bisa dibuka, pesanan masih diterima dan dibayar karena portal pelanggan berdiri sendiri, dan dashboard DOKU tetap menjadi sumber pembayaran |
| Biaya | Rp0 per bulan. Supabase Auth, Storage, dan Edge Functions masuk paket gratis, dan Telegram Bot API tidak berbayar |
| Bahasa dan format | Bahasa Indonesia, rupiah dan tanggal berformat Indonesia, zona Asia/Jakarta, CSV dalam UTF-8 dengan BOM |
| Pemeliharaan | Skema diubah lewat migrasi SQL Supabase CLI, dan cadangan memakai pg\_dump mingguan dari GitHub Actions yang sama dengan portal pelanggan, karena paket gratis Supabase tidak menyediakan cadangan yang bisa diunduh |