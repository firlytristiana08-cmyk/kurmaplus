// Tes konfigurasi deploy (wrangler.jsonc / wrangler.dev.jsonc).
//
// Latar: DOKU_CLIENT_ID dan DOKU_SECRET_KEY berulang kali hilang sehingga
// pembayaran daring mati. Berkas ini mengunci aturan yang sudah terbukti
// penting, supaya tidak terhapus lagi tanpa sengaja:
//
// 1. Tidak ada nilai rahasia di repo — rahasia hanya diisi lewat dasbor atau
//    `wrangler secret put`.
// 2. Var publik yang wajib selalu ada ikut ditulis di berkas konfigurasi
//    (bukan di dasbor), sehingga tidak mungkin hilang saat deploy.
// 3. Worker dev terpisah dan memakai DOKU sandbox, tidak pernah mencampur
//    produksi.
//
// PENTING (jangan diulang): `keep_vars: true` pernah dicoba di PR #36 dan
// membuat SEMUA Workers Builds GAGAL (kurmaplus & kurmaplus-dev). Jangan
// menambahkannya lagi tanpa menguji lewat Workers Builds yang sebenarnya —
// `wrangler deploy --dry-run` TIDAK cukup karena berhenti sebelum panggilan API.
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

describe("wrangler.jsonc (produksi)", () => {
  const config = readConfig("wrangler.jsonc");

  it("memuat var publik yang wajib (alamat DOKU tidak boleh hilang)", () => {
    // Bukan secret: nilainya harus ikut repo supaya tidak pernah terhapus.
    const vars = config.vars as Record<string, string>;
    expect(vars.DOKU_BASE_URL).toBe("https://api.doku.com");
    expect(vars.DOKU_ENV).toBe("production");
    expect(vars.SUPABASE_URL).toContain("supabase.co");
  });

  it("tidak memuat nilai rahasia apa pun", () => {
    const isi = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
    expect(isi).not.toMatch(/DOKU_CLIENT_ID"\s*:/);
    expect(isi).not.toMatch(/DOKU_SECRET_KEY"\s*:/);
    expect(isi).not.toMatch(/SUPABASE_DB_PASSWORD"\s*:/);
    expect(isi).not.toContain("service_role");
    // Kunci JWT Supabase (rahasia) tidak boleh ikut.
    expect(isi).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it("var sandi/token tidak pernah ditulis sebagai nilai biasa", () => {
    const vars = config.vars as Record<string, string>;
    // Kunci publishable/anon memang publik (dipakai peramban) — dikecualikan.
    const publik = /PUBLISHABLE|ANON/i;
    for (const nama of Object.keys(vars)) {
      if (publik.test(nama)) continue;
      expect(nama).not.toMatch(/SECRET|PASSWORD|TOKEN/i);
    }
  });

  it("TIDAK memakai keep_vars (terbukti menggagalkan build, PR #36)", () => {
    expect(config.keep_vars).toBeUndefined();
    expect(readFileSync(path.join(root, "wrangler.jsonc"), "utf8")).not.toContain("keep_vars");
  });
});

describe("wrangler.dev.jsonc (Worker dev)", () => {
  const config = readConfig("wrangler.dev.jsonc");

  it("tetap memakai DOKU sandbox dan Worker terpisah", () => {
    const vars = config.vars as Record<string, string>;
    expect(vars.DOKU_ENV).toBe("sandbox");
    expect(vars.DOKU_BASE_URL).toBe("https://api-sandbox.doku.com");
    expect(vars.PUBLIC_BASE_URL).toContain("kurmaplus-dev");
    expect(config.name).toBe("kurmaplus-dev");
  });

  it("TIDAK memakai keep_vars (penyebab build gagal, PR #36)", () => {
    expect(config.keep_vars).toBeUndefined();
  });

  it("tidak memuat client ID / secret key DOKU", () => {
    const isi = readFileSync(path.join(root, "wrangler.dev.jsonc"), "utf8");
    expect(isi).not.toMatch(/DOKU_CLIENT_ID"\s*:/);
    expect(isi).not.toMatch(/DOKU_SECRET_KEY"\s*:/);
  });
});
