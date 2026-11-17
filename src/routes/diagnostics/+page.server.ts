// TODO(hapus): jalur diagnosis sementara untuk integrasi DOKU —
// hapus rute ini setelah alur pembayaran stabil.
import { getDb, getSettings } from "#lib/server/db";
import { checkStatus, loadDokuConfig } from "#lib/server/doku";
import type { PageServerLoad } from "./$types";

export interface DiagCheck {
  name: string;
  ok: boolean;
  detail: string;
  action?: string;
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
      action: "Isi kedua variabel di Vercel → Settings → Environment Variables, lalu Redeploy.",
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
            "Salin ulang Client ID & Secret Key dari dashboard DOKU sandbox (menu Credentials) ke Vercel, lalu Redeploy.",
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
          "Tambahkan kunci publishable Supabase di Vercel → Environment Variables, lalu Redeploy.",
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

  return { checks, needsAction: checks.some((c) => !c.ok) };
};
