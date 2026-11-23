// Tes konfigurasi deploy (wrangler.jsonc / wrangler.dev.jsonc).
//
// Latar: setiap deploy dari GitHub (Workers Builds) menghapus variabel dan
// secret yang diisi di dasbor, karena wrangler memperlakukan berkas konfigurasi
// sebagai sumber kebenaran tunggal. Akibatnya DOKU_CLIENT_ID dan
// DOKU_SECRET_KEY berulang kali hilang sehingga pembayaran daring mati.
// (Lihat cloudflare/workers-sdk#8871.)
//
// Berkas ini mengunci pengamanannya supaya tidak terhapus lagi tanpa sengaja:
// 1. keep_vars = true  → nilai di dasbor tidak disentuh deploy.
// 2. secrets.required  → deploy berhenti bila secret wajib tidak ada.
// 3. Tidak ada nilai rahasia yang ikut masuk repo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Buang komentar // di luar string, lalu parse sebagai JSON. */
function parseJsonc(text: string): Record<string, unknown> {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += ch;
  }
  return JSON.parse(out) as Record<string, unknown>;
}

function readConfig(file: string): Record<string, unknown> {
  return parseJsonc(readFileSync(path.join(root, file), "utf8"));
}

const WAJIB = ["DOKU_CLIENT_ID", "DOKU_SECRET_KEY", "SUPABASE_DB_PASSWORD"];

describe("wrangler.jsonc (produksi)", () => {
  const config = readConfig("wrangler.jsonc");

  it("keep_vars aktif agar vars/secret dasbor tidak dihapus saat deploy", () => {
    expect(config.keep_vars).toBe(true);
  });

  it("mendaftarkan secret wajib agar deploy berhenti bila salah satu hilang", () => {
    const secrets = config.secrets as { required?: string[] } | undefined;
    expect(secrets?.required).toEqual(expect.arrayContaining(WAJIB));
  });

  it("DOKU_BASE_URL ada di vars (alamat publik, bukan rahasia)", () => {
    // Bukan secret: nilainya harus ikut repo supaya tidak pernah terhapus.
    const vars = config.vars as Record<string, string>;
    expect(vars.DOKU_BASE_URL).toBe("https://api.doku.com");
    expect(vars.DOKU_ENV).toBe("production");
  });

  it("tidak memuat nilai rahasia apa pun", () => {
    const isi = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
    // Client ID & secret key DOKU tidak boleh tertulis di repo.
    expect(isi).not.toMatch(/DOKU_CLIENT_ID"\s*:/);
    expect(isi).not.toMatch(/DOKU_SECRET_KEY"\s*:/);
    expect(isi).not.toMatch(/SUPABASE_DB_PASSWORD"\s*:/);
    // Tidak ada JWT/service-role key Supabase yang ikut terbawa.
    expect(isi).not.toContain("service_role");
    expect(isi).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it("var sandi/token tidak pernah ditulis sebagai nilai biasa", () => {
    const vars = config.vars as Record<string, string>;
    // Kunci publishable/anon memang publik (dipakai peramban) — dikecualikan.
    const publik = /PUBLISHABLE|ANON/i;
    for (const nama of Object.keys(vars)) {
      if (publik.test(nama)) continue;
      expect(nama).not.toMatch(/SECRET|PASSWORD|TOKEN|_KEY$/i);
    }
  });
});

describe("wrangler.dev.jsonc (Worker dev)", () => {
  const config = readConfig("wrangler.dev.jsonc");

  it("keep_vars aktif juga", () => {
    expect(config.keep_vars).toBe(true);
  });

  it("tetap memakai DOKU sandbox dan Worker terpisah", () => {
    const vars = config.vars as Record<string, string>;
    expect(vars.DOKU_ENV).toBe("sandbox");
    expect(vars.DOKU_BASE_URL).toBe("https://api-sandbox.doku.com");
    expect(vars.PUBLIC_BASE_URL).toContain("kurmaplus-dev");
    expect(config.name).toBe("kurmaplus-dev");
  });

  it("tidak memuat client ID / secret key DOKU", () => {
    const isi = readFileSync(path.join(root, "wrangler.dev.jsonc"), "utf8");
    expect(isi).not.toMatch(/DOKU_CLIENT_ID"\s*:/);
    expect(isi).not.toMatch(/DOKU_SECRET_KEY"\s*:/);
  });
});
