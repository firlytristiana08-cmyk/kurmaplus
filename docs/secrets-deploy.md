# Rahasia & deploy Cloudflare — kenapa hilang dan cara mengamankannya

## Gejala

`DOKU_CLIENT_ID` / `DOKU_SECRET_KEY` berulang kali hilang setelah merge ke `main`.
Akibatnya (karena sistem fail-closed) pembayaran daring mati: pembeli tidak
diarahkan ke halaman bayar DOKU, dan `/diagnostics` melaporkan kredensial kosong.

## Penyebab

Wrangler memperlakukan berkas konfigurasi sebagai **sumber kebenaran tunggal**,
seperti terraform. Dikutip dari skema konfigurasi wrangler sendiri:

> "By default, the Wrangler configuration file is the source of truth for your
> environment configuration, like a terraform file. **If you change your vars in
> the dashboard, wrangler _will_ override/delete them on its next deploy.**"

Jadi setiap deploy dari GitHub (Workers Builds) **menghapus** apa pun yang diisi
di dasbor tetapi tidak ada di `wrangler.jsonc`. Ini perilaku yang dilaporkan luas:
[cloudflare/workers-sdk#8871](https://github.com/cloudflare/workers-sdk/issues/8871).

## Pengamanan yang sudah dipasang

| Setelan | Berkas | Efek |
|---|---|---|
| `"keep_vars": true` | `wrangler.jsonc`, `wrangler.dev.jsonc` | Nilai yang diisi di dasbor **tidak** disentuh deploy |
| `"secrets": { "required": [...] }` | `wrangler.jsonc` | Deploy **berhenti** bila salah satu secret wajib tidak ada |
| `DOKU_BASE_URL` di `vars` | `wrangler.jsonc` | Alamat publik (bukan rahasia) ikut repo sehingga tidak bisa terhapus |

Secret wajib yang didaftarkan: `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`,
`SUPABASE_DB_PASSWORD`.

Dikunci oleh tes: `src/lib/server/wrangler-config.test.ts` (8 tes) — termasuk
memastikan **tidak ada nilai rahasia** yang ikut masuk repo.

## Perilaku bila secret hilang

Dengan `secrets.required`, deploy **gagal** dan versi lama tetap melayani.
Ini disengaja: lebih baik situs tetap hidup dengan versi sebelumnya daripada
tayang tanpa pembayaran. Cek status build di dasbor Cloudflare →
Workers Builds, atau di PR (centang "Workers Builds").

## Cara mengisi / memulihkan secret

Cloudflare → **Workers & Pages** → `kurmaplus` → **Settings** →
**Variables and Secrets** → **Add** → pilih tipe **Secret**:

| Nama | Nilai |
|---|---|
| `DOKU_CLIENT_ID` | dashboard DOKU → Settings → API Keys |
| `DOKU_SECRET_KEY` | pasangannya |
| `SUPABASE_DB_PASSWORD` | sandi database Supabase |

Atau lewat CLI (nilai dibaca dari berkas, tidak pernah muncul di riwayat shell):

```bash
npx wrangler secret put DOKU_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put DOKU_SECRET_KEY --config wrangler.jsonc
npx wrangler secret put SUPABASE_DB_PASSWORD --config wrangler.jsonc
```

Worker dev (`kurmaplus-dev`) punya secret sendiri untuk DOKU **sandbox**:

```bash
npx wrangler secret put DOKU_CLIENT_ID --config wrangler.dev.jsonc
npx wrangler secret put DOKU_SECRET_KEY --config wrangler.dev.jsonc
```

## Memeriksa kesehatan tanpa membuka dasbor

Buka **Portal Admin → Beranda**: ada lencana
**"Pembayaran DOKU aktif"** (hijau) atau **"belum aktif"** (merah) beserta
sebab dan tindakannya. Rincian lengkap ada di `/diagnostics`, yang kini hanya
bisa dibuka dengan sesi admin.

## Batasan yang perlu diketahui

`keep_vars` bergantung pada Wrangler yang dipakai saat deploy. Bila Cloudflare
mengubah perilaku build-nya, pengaman ini bisa berubah. Karena itu
`secrets.required` dipertahankan: ia menjadikan kegagalan **terlihat**
(build gagal) alih-alih diam-diam tayang tanpa pembayaran.

Cadangan bila masalah berulang:

1. Cek apakah `keep_vars` masih terkirim ke output build:
   `python3 -c "import json;print(json.load(open('.svelte-kit/output/server/wrangler.json'))['keep_vars'])"`
2. Deep-link dasbor untuk mengisi ulang dengan cepat:
   `https://dash.cloudflare.com/?to=/:account/workers/services/view/kurmaplus/production/settings`
