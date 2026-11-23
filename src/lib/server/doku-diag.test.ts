// Tes diagnosis konfigurasi DOKU.
//
// Regresi yang dijaga: pesan /diagnostics pernah menyebut "kredensial belum
// terisi" padahal kredensial ada dan yang hilang justru DOKU_BASE_URL setelah
// deploy. Diagnosis harus membedakan sebab-sebab itu.
import { describe, expect, it } from "vitest";
import { diagnoseDoku } from "./doku-diag";

const CREDS = { DOKU_CLIENT_ID: "client-12345678", DOKU_SECRET_KEY: "secret-999" };
const PROD = {
  DOKU_ENV: "production",
  PUBLIC_BASE_URL: "https://kurmaplus.hasbidiqi16.workers.dev",
};

describe("diagnoseDoku: membedakan sebab kegagalan", () => {
  it("konfigurasi lengkap di produksi → ok, basis production", () => {
    const diag = diagnoseDoku({ ...CREDS, ...PROD, DOKU_BASE_URL: "https://api.doku.com" });
    expect(diag.ok).toBe(true);
    expect(diag.code).toBe("ok");
    expect(diag.config?.baseUrl).toBe("https://api.doku.com");
    expect(diag.action).toBeNull();
  });

  it("produksi tanpa DOKU_BASE_URL → sebab 'missing_base_url', bukan 'kredensial kosong'", () => {
    const diag = diagnoseDoku({ ...CREDS, ...PROD });
    expect(diag.ok).toBe(false);
    expect(diag.code).toBe("missing_base_url");
    // Pesan harus menyebut DOKU_BASE_URL, bukan menyalahkan kredensial.
    expect(diag.detail).toContain("DOKU_BASE_URL");
    expect(diag.detail).not.toContain("DOKU_CLIENT_ID");
    expect(diag.action).toContain("https://api.doku.com");
  });

  it("tanpa kredensial → sebab 'missing_both'", () => {
    const diag = diagnoseDoku({ ...PROD, DOKU_BASE_URL: "https://api.doku.com" });
    expect(diag.code).toBe("missing_both");
    expect(diag.detail).toContain("DOKU_CLIENT_ID");
    expect(diag.detail).toContain("DOKU_SECRET_KEY");
  });

  it("hanya satu kredensial hilang → menyebut yang mana", () => {
    const noSecret = diagnoseDoku({
      DOKU_CLIENT_ID: "client-12345678",
      ...PROD,
      DOKU_BASE_URL: "https://api.doku.com",
    });
    expect(noSecret.code).toBe("missing_credentials");
    expect(noSecret.detail).toContain("DOKU_SECRET_KEY");
    expect(noSecret.detail).not.toContain("DOKU_CLIENT_ID");

    const noId = diagnoseDoku({
      DOKU_SECRET_KEY: "secret-999",
      ...PROD,
      DOKU_BASE_URL: "https://api.doku.com",
    });
    expect(noId.code).toBe("missing_credentials");
    expect(noId.detail).toContain("DOKU_CLIENT_ID");
  });

  it("nilai berisi spasi saja dianggap kosong", () => {
    const diag = diagnoseDoku({ ...CREDS, ...PROD, DOKU_BASE_URL: "   " });
    expect(diag.code).toBe("missing_base_url");
  });

  it("sandbox tanpa DOKU_BASE_URL tetap boleh (tidak fail-closed)", () => {
    const diag = diagnoseDoku({ ...CREDS, DOKU_ENV: "sandbox" });
    expect(diag.ok).toBe(true);
    expect(diag.config?.baseUrl).toBe("https://api-sandbox.doku.com");
  });

  it("host produksi dikenali walau DOKU_ENV tidak diisi", () => {
    const diag = diagnoseDoku({
      ...CREDS,
      PUBLIC_BASE_URL: "https://kurmaplus.hasbidiqi16.workers.dev",
    });
    expect(diag.code).toBe("missing_base_url");
  });

  it("tidak pernah membocorkan nilai rahasia di detail/action", () => {
    const diag = diagnoseDoku({ ...CREDS, ...PROD });
    const text = `${diag.detail} ${diag.action ?? ""}`;
    expect(text).not.toContain("secret-999");
    expect(text).not.toContain("client-12345678");
  });
});
