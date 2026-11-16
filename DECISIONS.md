# Keputusan implementasi

Catatan untuk setiap penyimpangan dari PRD dan setiap nilai yang masih sementara.
Aturan 5 PRD: dependensi baru hanya masuk bila alasannya dicatat di berkas ini.

## Penyimpangan dari PRD (diputuskan bersama lewat instruksi pengguna)

| Hal | PRD | Implementasi | Alasan |
| --- | --- | --- | --- |
| Alamat katalog | `/` | `/` = layar masuk (splash), katalog di `/katalog` | Pengguna meminta layar masuk "sebelum masuk ke portal pelanggan" dan tombol Beli Kurma mengarah ke katalog. |
| Tata letak desktop | Konten maksimal 960 px, checkout dua kolom | Selalu satu kolom gaya mobile (maksimal 430 px) di tengah, latar memenuhi layar | Instruksi pengguna: "tampilan nya seperti mobile, saat responsive apapun". |
| Warna tombol & wordmark | Karamel `#A4511C`, plus karamel | Tombol dan "PLUS" `#AB3710`, teks `#2D264B` | Mockup yang disetujui pengguna (ukur piksel), berlaku untuk seluruh portal. |
| Styling | Tailwind CSS 4 | CSS tulisan tangan dengan token warna persis PRD | Tampilan sudah disetujui pengguna lewat mockup; transisi ke Tailwind berisiko mengubah hasil yang disetujui. Nol dependensi build styling. |
| PWA | `@vite-pwa/sveltekit` | Manifest + service worker tulisan tangan di `static/` | Perilaku cache sudah disetujui pengguna (jaringan-dulu untuk teks); plugin menambah konfigurasi yang tidak bisa diuji di sandbox. |
| Gambar | `@sveltejs/enhanced-img` | WebP statis hasil optimasi | Kebutuhan ukuran sudah dipenuhi lewat optimasi manual. |
| ORM | Drizzle + drizzle-kit | `src/lib/server/db.ts` dengan antarmuka gaya D1 (`prepare().bind().all/run`) atas `node:sqlite` | Berjalan penuh di sandbox tanpa wrangler; SQL yang sama dipakai saat dipindah ke D1. Skema tetap SQL bacaan di `db/migrations`. |
| Tes E2E | Playwright | Tidak dipasang | Sandbox memblokir unduhan browser Playwright; verifikasi alur lewat pratinjau dan tes unit. |
| Foto produk | Foto asli pemilik, tanpa gambar AI | Sementara memakai foto hasil generate, **wajib diganti foto asli pemilik sebelum rilis** | PRD melarang foto produk AI untuk rilis; pemilik belum mengirim foto. Kolom `photo` sudah siap untuk penukaran. |
| Basis data | Supabase (PRD semula Cloudflare D1, diperbarui atas permintaan pengguna) | Skema 7 tabel + data 3 produk/9 varian/pengaturan dimasukkan ke proyek Supabase `dmwtrtcehxjcweoanbsx` | Aplikasi pratinjau membaca database lokal (jaringan sandbox tidak menjangkau Supabase); lapisan `src/lib/server/db` memakai SQL yang sama dan tinggal diarahkan ke Supabase saat deployment. |
| Driver basis data | PRD menetapkan Drizzle ORM | `pg` (node-postgres) di balik lapisan `Db` sendiri di `src/lib/server/db`; kueri tetap SQL mentah bertipe `?` yang diterjemahkan ke `$n` | `pg` mapan dan parser tipe-nya bisa dikontrol penuh (waktu/tanggal/angka besar disamakan dengan SQLite). Drizzle ditunda agar kueri yang sudah teruji tidak ditulis ulang; penggantian ORM tetap terbuka lewat antarmuka `Db`. |
| Pemilihan driver | — | `KURMAPLUS_DB=supabase` (ketat) / `sqlite` / `auto` (bawaan): auto memakai Supabase bila kredensial ada (`.dev.vars.local` → `DATABASE_URL`/`SUPABASE_PROJECT_REF`+`SUPABASE_DB_PASSWORD`), dan hanya di luar produksi jatuh ke SQLite lokal bila Supabase tidak terjangkau | Jaringan sandbox pratinjau tidak dapat menjangkau supabase.co; di Vercel/produksi koneksi langsung ke Supabase dipakai dan galat koneksi tidak boleh diam-diam jatuh ke basis data lain. |

## Dependensi (alasan singkat)

| Paket | Alasan (merujuk PRD) |
| --- | --- |
| `valibot` | PRD: validasi skema yang sama di server dan klien, ukuran kecil. |
| `leaflet` | PRD: peta penandaan lokasi di checkout, tile OSM gratis. |
| `vitest` | PRD: logika uang, jadwal, stok, signature wajib bertes. |
| `@biomejs/biome` | PRD: lint dan format satu alat. |
| SvelteKit, Svelte, adapter-node, vite, typescript, svelte-check | PRD: tumpukan inti (adapter-node → host Node/Vercel; adapter-cloudflare dibuang karena menyalakan runtime workerd tambahan dan menyumbang port pratinjau ekstra). |
| Pratinjau memakai build produksi | — | Pratinjau dijalankan dari `npm run preview` (build produksi + `node build/index.js`), bukan `vite dev` | Mesin dev menyusun ulang halaman diam-diam dan memicu kedipan "hilang-muncul" di balik proksi pratinjau; build produksi memberi respons konstan cepat sekaligus menguji artefak yang akan dideploy. `KURMAPLUS_DB=sqlite` karena sandbox tidak menjangkau Supabase; di Vercel koneksi ke Supabase dipakai. |

## Nilai sementara (tanda "(belum ditentukan)" di PRD — diisi pemilik lewat tabel settings sebelum rilis)

| Pengaturan | Nilai awal sekarang | Sumber PRD |
| --- | --- | --- |
| Batas pesan masuk jadwal | Kamis 23.59 Asia/Jakarta | BR-02 "usulan" — dipakai apa adanya. |
| Batas waktu bayar | 60 menit | BR-12. |
| Kapasitas per tanggal kirim | 20 pesanan | BR-04 "(belum ditentukan)". |
| Batas koordinat Jabodetabek | lat −6,95..−5,85; lng 106,25..107,45 | BR-05. |
| Nomor WhatsApp pemilik | `6281234567890` | "(belum ditentukan)" — baris `settings` key `whatsapp_owner`. |
| Harga & stok 9 varian | Lihat `db/seed.sql` | Harga tidak tercantum di PRD; angka pasar sementara, wajib dikonfirmasi pemilik. |
| Pilihan ukuran varian | 500 gr, 1 kg, 3 kg per produk | Skenario PRD menyebut 500 gr/1 kg (keluarga) dan 3 kg/5 kg (partai); 9 varian = 3 produk × 3 ukuran. |

## Penyimpanan lokal sandbox

Database berkas SQLite di `.data/kurmaplus.db` (gitignored) dibuat otomatis dari `db/migrations` + `db/seed.sql` saat pertama diakses. Di Cloudflare, `src/lib/server/db.ts` dipindah ke binding D1 dengan SQL yang sama.
