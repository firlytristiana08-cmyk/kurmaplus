// Diagnosis konfigurasi DOKU: MEMBEDAKAN sebab kegagalan.
//
// Latar: `loadDokuConfig` mengembalikan null karena dua sebab yang berbeda,
// tetapi halaman /diagnostics dulu melaporkan keduanya sebagai "kredensial
// belum terisi". Pada 23 Nov 2026 pesan itu menyesatkan: kredensial DOKU
// sebenarnya ada, yang hilang adalah DOKU_BASE_URL setelah deploy.
//
// Modul ini murni (tanpa efek samping) supaya bisa diuji.
import type { DokuConfig } from "./doku";
import { loadDokuConfig } from "./doku";

export type DokuDiagCode = "ok" | "missing_credentials" | "missing_base_url" | "missing_both";

export interface DokuDiag {
  code: DokuDiagCode;
  ok: boolean;
  /** Ringkasan singkat untuk ditampilkan. */
  detail: string;
  /** Langkah perbaikan yang spesifik untuk sebab tersebut. */
  action: string | null;
  config: DokuConfig | null;
}

const SANDBOX = "https://api-sandbox.doku.com";

function filled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

// Konteks produksi disalin dari doku.ts (isProductionContext tidak diekspor):
// DOKU_ENV eksplisit, atau jejak Vercel, atau host produksi yang dikenal.
function productionContext(env: Record<string, string | undefined>): boolean {
  const declared = (env.DOKU_ENV ?? "").trim().toLowerCase();
  if (declared === "production" || declared === "live") return true;
  if (declared === "sandbox" || declared === "dev" || declared === "development") return false;
  if (env.VERCEL_ENV === "production") return true;
  const host = (env.PUBLIC_BASE_URL ?? "").trim();
  return host.includes("kurmaplus.hasbidiqi16.workers.dev");
}

export function diagnoseDoku(env: Record<string, string | undefined>): DokuDiag {
  const hasId = filled(env.DOKU_CLIENT_ID);
  const hasSecret = filled(env.DOKU_SECRET_KEY);
  const hasBaseUrl = filled(env.DOKU_BASE_URL);
  const isProd = productionContext(env);
  const config = loadDokuConfig(env);

  // Jalur bahagia: konfigurasi terbentuk dan pembayaran daring aktif.
  if (config !== null) {
    return {
      code: "ok",
      ok: true,
      detail: `Konfigurasi lengkap — basis ${config.baseUrl}.`,
      action: null,
      config,
    };
  }

  // Fail-closed di produksi: kredensial ada, tetapi alamat API tidak eksplisit.
  // Inilah kasus yang dulu salah dilaporkan sebagai "kredensial kosong".
  if (isProd && hasId && hasSecret && !hasBaseUrl) {
    return {
      code: "missing_base_url",
      ok: false,
      detail:
        "Kredensial DOKU terisi, tetapi DOKU_BASE_URL belum diisi. Di lingkungan produksi aplikasi menolak menebak alamat API (fail-closed), sehingga pembayaran daring dimatikan.",
      action:
        "Isi DOKU_BASE_URL = https://api.doku.com. Nilai ini sudah ada di wrangler.jsonc, jadi cukup deploy ulang Worker — tidak perlu mengisi manual di dasbor.",
      config: null,
    };
  }

  if (!hasId || !hasSecret) {
    // "missing_both" = kedua kredensial tidak ada; bila hanya satu, sebutkan
    // yang mana. Status DOKU_BASE_URL tidak mengubah penamaan ini.
    const both = !hasId && !hasSecret;
    return {
      code: both ? "missing_both" : "missing_credentials",
      ok: false,
      detail: both
        ? "DOKU_CLIENT_ID dan DOKU_SECRET_KEY belum terisi di lingkungan ini."
        : `DOKU_${hasId ? "SECRET_KEY" : "CLIENT_ID"} belum terisi di lingkungan ini.`,
      action:
        "Isi sebagai Secret di Cloudflare → Worker kurmaplus → Settings → Variables and Secrets (pilih tipe Secret), lalu deploy ulang. Kunci rahasia TIDAK disimpan di repo.",
      config: null,
    };
  }

  // Sisa kemungkinan (tidak diharapkan): jangan menebak sebabnya.
  return {
    code: "missing_credentials",
    ok: false,
    detail: "Konfigurasi DOKU tidak dapat dibentuk dari variabel lingkungan saat ini.",
    action: "Periksa DOKU_CLIENT_ID, DOKU_SECRET_KEY, dan DOKU_BASE_URL.",
    config: null,
  };
}

export const SANDBOX_BASE_URL = SANDBOX;
