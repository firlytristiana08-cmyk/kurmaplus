# Rahasia & deploy Cloudflare — kenapa DOKU_CLIENT_ID hilang

## Gejala

`DOKU_CLIENT_ID` / `DOKU_SECRET_KEY` berulang kali hilang setelah merge ke `main`.
Karena sistem sengaja *fail-closed*, pembayaran daring ikut mati: pembeli tidak
diarahkan ke halaman bayar DOKU.

## Riwayat percobaan — dan hasilnya

| Percobaan | Hasil |
|---|---|
| `DOKU_BASE_URL` ditulis di `wrangler.jsonc` (PR #33) | ✅ Bertahan — nilainya tetap ada sesudah deploy |
| `DOKU_CLIENT_ID` / `DOKU_SECRET_KEY` disimpan di **dasbor** | ❌ Berulang kali hilang (masalah awal) |
| `"keep_vars": true` (PR #36, 23 Nov 2026) | ❌ **Semua build gagal** — sudah dibatalkan |

Kesimpulan dari perbandingan itu:

> **Var yang ditulis di `wrangler.jsonc` bertahan. Nilai yang diisi di dasbor
> hilang.** Jadi solusinya bukan menambahkan `keep_vars`, melainkan memastikan
> nilainya disimpan sebagai **Secret** — bukan sebagai Text/Variable.

## Akar masalah

Wrangler memperlakukan berkas konfigurasi sebagai **sumber kebenaran tunggal**,
seperti terraform. Dikutip dari skema konfigurasi Wrangler sendiri:

> "By default, the Wrangler configuration file is the source of truth for your
> environment configuration, like a terraform file. **If you change your vars in
> the dashboard, wrangler _will_ override/delete them on its next deploy.**"

Deploy Workers Builds menjalankan langkah ini: hapus dulu var lama, lalu tulis
yang ada di konfigurasi — apa pun yang hanya ada di dasbor ikut terhapus.
Laporan serupa: [cloudflare/workers-sdk#8871](https://github.com/cloudflare/workers-sdk/issues/8871).

Menurut dokumentasi Cloudflare, **secret tidak dihapus** oleh deploy. Karena
`DOKU_CLIENT_ID` tetap hilang, kemungkinan besar nilainya tersimpan sebagai
**Text/Variable**, sehingga ikut proses hapus-tulis di atas.

## Solusi

### 1. Pastikan tipenya **Secret**, bukan Text

Cloudflare → **Workers & Pages** → `kurmaplus` → **Settings** →
**Variables and Secrets** → lihat baris `DOKU_CLIENT_ID`.

- Kalau tertulis **Text** / **Variable** → hapus, lalu tambahkan ulang dengan
  tipe **Secret**. Ini kemungkinan besar penyebab utamanya.
- Secret disimpan terenkripsi dan tidak ikut dihapus saat deploy.

### 2. Simpan di luar repo

Rahasia **tidak boleh** masuk `wrangler.jsonc` (repo publik). Tiga cara, dari
yang paling praktis:

| Cara | Perintah / tempat | Catatan |
|---|---|---|
| CLI (disarankan) | `npx wrangler secret put DOKU_CLIENT_ID --config wrangler.jsonc` | Nilai diketik di prompt, tidak masuk riwayat shell |
| Dasbor | Settings → Variables and Secrets → tipe **Secret** | Paling mudah, tapi rawan salah tipe (lihat atas) |
| Berkas lokal | `npx wrangler versions upload --secrets-file ./secrets.json` | `secrets.json` **jangan** di-commit; hapus sesudahnya |

Worker dev (`kurmaplus-dev`) punya secret sendiri untuk DOKU **sandbox**:

```bash
npx wrangler secret put DOKU_CLIENT_ID --config wrangler.dev.jsonc
npx wrangler secret put DOKU_SECRET_KEY --config wrangler.dev.jsonc
```

### 3. Pantau otomatis, jangan menunggu laporan pembeli

Panel **Beranda admin** menampilkan lencana:
**"Pembayaran DOKU aktif"** (hijau) atau **"belum aktif"** (merah) beserta
sebab dan tindakannya. Rincian di `/diagnostics` (khusus sesi admin).

Bila lencana merah → isi ulang secret lewat langkah 1 atau 2. Ini menjadikan
masalahnya **terlihat dalam hitungan detik**, bukan setelah ada pesanan gagal.

### 4. Yang **tidak** dipakai

- ❌ `keep_vars: true` — dicoba di PR #36 dan membuat **semua Workers Builds
  gagal** (23 Nov 2026). Sudah dibatalkan; jangan ditambahkan lagi.
- ❌ `secrets: { required: [...] }` — tidak dipakai: bila secret memang sedang
  hilang, deploy langsung gagal. Untuk situs yang sedang melayani pesanan,
  membiarkan versi lama tetap hidup lebih aman daripada build merah berulang.

## Memulihkan bila secret hilang lagi

1. Ambil nilai dari dasbor DOKU → Settings → API Keys.
2. Jalankan:
   `npx wrangler secret put DOKU_CLIENT_ID --config wrangler.jsonc`
   lalu `npx wrangler secret put DOKU_SECRET_KEY --config wrangler.jsonc`.
3. Buka **Beranda admin** → pastikan lencana hijau.
4. Uji satu pesanan kecil → harus diarahkan ke halaman bayar DOKU.

Langkah 2 tidak butuh build/deploy baru: secret langsung berlaku pada versi
yang sedang melayani.
