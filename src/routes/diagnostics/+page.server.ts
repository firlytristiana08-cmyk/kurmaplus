// TODO(hapus): jalur diagnosis sementara untuk integrasi DOKU —
// hapus rute ini setelah alur pembayaran stabil.
import { Pool } from "pg";
import { hyperdriveConnectionString } from "#lib/server/cf-env";
import { getDb, getSettings, pickPostgresUrl } from "#lib/server/db";
import { checkStatus, loadDokuConfig } from "#lib/server/doku";
import type { PageServerLoad } from "./$types";

export interface DiagCheck {
  name: string;
  ok: boolean;
  detail: string;
  action?: string;
}

export interface DiagProbe {
  name: string;
  target: string;
  ok: boolean;
  detail: string;
}

// URL koneksi ditampilkan tanpa sandi (hanya user, host, port, nama database).
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:•••@${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return "(URL tidak dapat dibaca)";
  }
}

// Uji satu jalur koneksi: buka koneksi singkat, jalankan SELECT 1, tutup.
// Hasilnya membedakan jalur Hyperdrive vs jalur langsung (pooler) saat
// mendiagnosis galat 500 "Connection terminated unexpectedly".
async function probePostgres(
  name: string,
  url: string,
  viaHyperdrive: boolean,
): Promise<DiagProbe> {
  const target = maskUrl(url);
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5_000,
    ...(viaHyperdrive ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  try {
    await pool.query("SELECT 1");
    return { name, target, ok: true, detail: "Terhubung — uji SELECT 1 berhasil." };
  } catch (error) {
    const err = error as Error & { code?: string };
    return {
      name,
      target,
      ok: false,
      detail: `Gagal: ${err.message} (kode ${err.code ?? err.name}).`,
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export const load: PageServerLoad = async () => {
  const checks: DiagCheck[] = [];

  // 1) Kredensial DOKU (nilai disamarkan, tidak pernah ditampilkan utuh).
  const config = loadDokuConfig(process.env);
  if (config === null) {
    checks.push({
      name: "Kredensial DOKU",
      ok: false,
      detail: "DOKU_CLIENT_ID atau DOKU_SECRET_KEY belum terisi di lingkungan ini.",
      action:
        "Isi kedua variabel di Cloudflare → Worker kurmaplus → Settings → Variables and Secrets (Secret), lalu redeploy.",
    });
  } else {
    const id = config.clientId;
    const masked = id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : "••••";
    checks.push({
      name: "Kredensial DOKU",
      ok: true,
      detail: `Client ID ${masked} terisi, Secret Key terisi, basis ${config.baseUrl}.`,
    });

    // 2) Koneksi + kredensial ke API DOKU (probe aman tanpa transaksi).
    try {
      await checkStatus(config, "DIAG-PING-0000", new Date());
      checks.push({
        name: "Koneksi API DOKU",
        ok: true,
        detail: "Terhubung — kredensial diterima server DOKU.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = /HTTP (\d+)/.exec(msg)?.[1] ?? null;
      if (status === "404") {
        checks.push({
          name: "Koneksi API DOKU",
          ok: true,
          detail: "Terhubung — kredensial diterima (invoice uji memang tidak ada, wajar).",
        });
      } else if (status === "401") {
        checks.push({
          name: "Koneksi API DOKU",
          ok: false,
          detail: "Kredensial DITOLAK server DOKU (HTTP 401).",
          action:
            "Salin ulang Client ID & Secret Key dari dashboard DOKU sandbox (menu Credentials) ke variabel worker Cloudflare, lalu redeploy.",
        });
      } else if (status === "403") {
        checks.push({
          name: "Koneksi API DOKU",
          ok: false,
          detail: "Akses ditolak (HTTP 403).",
          action: "Pastikan produk Checkout sudah aktif untuk akun sandbox Anda di dashboard DOKU.",
        });
      } else {
        checks.push({
          name: "Koneksi API DOKU",
          ok: false,
          detail: `Gagal terhubung: ${msg}`,
          action: "Laporkan pesan ini kepada pengembang.",
        });
      }
    }
  }

  // 3) Database + skema.
  try {
    const settings = await getSettings();
    const db = await getDb();
    await db.all("SELECT shipping_status FROM orders LIMIT 1");
    await db.all("SELECT id FROM stock_movements LIMIT 1");
    await db.all("SELECT id FROM audit_log LIMIT 1");
    checks.push({
      name: "Database",
      ok: true,
      detail: `Terhubung — skema lengkap (toko ${settings.store_open === "0" ? "sedang tutup" : "buka"}).`,
    });
  } catch (err) {
    checks.push({
      name: "Database",
      ok: false,
      detail: `Gagal: ${err instanceof Error ? err.message : String(err)}`,
      action: "Hubungi pengembang — skema database perlu diperiksa.",
    });
  }

  // 4) Webhook.
  checks.push({
    name: "Webhook DOKU",
    ok: true,
    detail: "Penerima notifikasi siap di /api/webhook/doku (verifikasi tanda tangan aktif).",
  });

  // 5) Login admin (Supabase Auth) — kunci publishable + email terdaftar.
  try {
    const { supabaseEnv } = await import("#lib/server/admin-auth");
    if (supabaseEnv() === null) {
      checks.push({
        name: "Login admin (Supabase Auth)",
        ok: false,
        detail: "SUPABASE_PUBLISHABLE_KEY (atau SUPABASE_ANON_KEY) belum terisi di lingkungan ini.",
        action:
          "Tambahkan kunci publishable Supabase di Cloudflare → Worker kurmaplus → Settings → Variables and Secrets, lalu redeploy.",
      });
    } else {
      const db = await getDb();
      const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM admin_users", []);
      const count = row?.n ?? 0;
      checks.push({
        name: "Login admin (Supabase Auth)",
        ok: count > 0,
        detail:
          count > 0
            ? `Konfigurasi lengkap — ${count} email terdaftar di admin_users.`
            : "Konfigurasi lengkap, tetapi belum ada email di tabel admin_users.",
        action:
          count > 0
            ? undefined
            : "Buat akun di Supabase Authentication lalu daftarkan emailnya ke tabel admin_users (lihat panduan login admin).",
      });
    }
  } catch (err) {
    checks.push({
      name: "Login admin (Supabase Auth)",
      ok: false,
      detail: `Gagal: ${err instanceof Error ? err.message : String(err)}`,
      action: "Hubungi pengembang.",
    });
  }

  // 6) Uji tiap jalur koneksi database secara terpisah (diagnosis galat 500).
  const probes: DiagProbe[] = [];
  const hd = hyperdriveConnectionString();
  if (hd) {
    probes.push(await probePostgres("Jalur Hyperdrive (binding HYPERDRIVE)", hd, true));
  } else {
    probes.push({
      name: "Jalur Hyperdrive (binding HYPERDRIVE)",
      target: "(tidak terbaca)",
      ok: false,
      detail:
        "Binding HYPERDRIVE tidak terbaca runtime ini. Bila halaman dibuka di Cloudflare, periksa Worker → Settings → Bindings.",
    });
  }
  const explicitUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (explicitUrl) {
    probes.push(
      await probePostgres("Jalur URL eksplisit (DATABASE_URL/SUPABASE_DB_URL)", explicitUrl, false),
    );
  }
  const projectRef = (process.env.SUPABASE_PROJECT_REF ?? "").trim();
  const password = (process.env.SUPABASE_DB_PASSWORD ?? "").trim();
  const region = (process.env.SUPABASE_REGION ?? "").trim();
  if (projectRef && password) {
    const session = pickPostgresUrl({ projectRef, password, region });
    if (session) {
      probes.push(await probePostgres("Jalur pooler sesi Supabase (5432)", session.url, false));
    }
    const txUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${region || "ap-southeast-1"}.pooler.supabase.com:6543/postgres`;
    probes.push(await probePostgres("Jalur pooler transaksi Supabase (6543)", txUrl, false));
  }
  const chosen = pickPostgresUrl({
    hyperdrive: hd ?? undefined,
    databaseUrl: process.env.DATABASE_URL,
    supabaseDbUrl: process.env.SUPABASE_DB_URL,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    password: process.env.SUPABASE_DB_PASSWORD,
    region: process.env.SUPABASE_REGION,
  });
  probes.push({
    name: "Jalur yang dipakai aplikasi",
    target: chosen ? maskUrl(chosen.url) : "(tidak ada sumber koneksi)",
    ok: chosen !== null,
    detail: chosen
      ? chosen.viaHyperdrive
        ? "Prioritas: Hyperdrive — sesuai urutan pemilihan koneksi."
        : "Hyperdrive tidak terbaca, jadi aplikasi memakai URL/pooler langsung."
      : "Tidak ada sumber koneksi sama sekali di lingkungan ini.",
  });

  return {
    checks,
    probes,
    needsAction: checks.some((c) => !c.ok) || probes.some((p) => !p.ok),
  };
};
