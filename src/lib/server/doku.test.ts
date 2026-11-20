import { describe, expect, it, vi } from "vitest";
import {
  createCheckoutPayment,
  type DokuConfig,
  digestBase64,
  loadDokuConfig,
  requestTimestamp,
  signHmacSha256,
  stringToSign,
  verifyNotificationSignature,
} from "./doku";

// Golden vector: dihitung sekali dari rumus dokumentasi resmi DOKU Non-SNAP
// lalu dikunci di sini agar perubahan tidak disengaja terdeteksi.
const BODY = '{"order":{"amount":20000,"invoice_number":"ABC12345"}}';
const EXPECTED_DIGEST = "T4aGoSmykptc/j6iP4mlY1fB3Gd3JC3qzk+2LxQafjc=";
const EXPECTED_SIGNATURE = "HMACSHA256=5UJE+dQ1LQtKUqSX6Ji5scm6I/EV1rLR+SEfsvPrdno=";

const config: DokuConfig = {
  clientId: "MCH-TEST",
  secretKey: "secret-key-uji",
  baseUrl: "https://api-sandbox.doku.com",
};

describe("signature DOKU (Non-SNAP)", () => {
  it("digest = base64 SHA-256 isi permintaan", async () => {
    expect(await digestBase64(BODY)).toBe(EXPECTED_DIGEST);
  });

  it("string-to-sign berformat lima baris tanpa baris kosong di akhir", () => {
    const raw = stringToSign({
      clientId: "MCH-TEST",
      requestId: "req-1",
      requestTimestamp: "2026-11-14T03:00:00Z",
      requestTarget: "/checkout/v1/payment",
      digest: EXPECTED_DIGEST,
    });
    expect(raw.split("\n")).toHaveLength(5);
    expect(raw.endsWith("\n")).toBe(false);
  });

  it("signature = HMACSHA256= + base64 HMAC-SHA256", async () => {
    const raw = stringToSign({
      clientId: "MCH-TEST",
      requestId: "req-1",
      requestTimestamp: "2026-11-14T03:00:00Z",
      requestTarget: "/checkout/v1/payment",
      digest: EXPECTED_DIGEST,
    });
    expect(await signHmacSha256("secret-key-uji", raw)).toBe(EXPECTED_SIGNATURE);
  });

  it("metode GET tidak memakai baris Digest", () => {
    const raw = stringToSign({
      clientId: "MCH-TEST",
      requestId: "req-2",
      requestTimestamp: "2026-11-14T03:00:00Z",
      requestTarget: "/orders/v1/status/ABC12345",
    });
    expect(raw.split("\n")).toHaveLength(4);
    expect(raw).not.toContain("Digest:");
  });

  it("verifikasi notifikasi menolak signature yang salah", async () => {
    const valid = await verifyNotificationSignature({
      config,
      clientId: "MCH-TEST",
      requestId: "req-1",
      requestTimestamp: "2026-11-14T03:00:00Z",
      requestTarget: "/api/webhook/doku",
      rawBody: BODY,
      signature: EXPECTED_SIGNATURE.replace(/.$/, "x"),
    });
    expect(valid).toBe(false);

    const wrongClient = await verifyNotificationSignature({
      config,
      clientId: "MCH-LAIN",
      requestId: "req-1",
      requestTimestamp: "2026-11-14T03:00:00Z",
      requestTarget: "/api/webhook/doku",
      rawBody: BODY,
      signature: EXPECTED_SIGNATURE,
    });
    expect(wrongClient).toBe(false);
  });

  it("stamp waktu memakai ISO-8601 UTC tanpa milidetik", () => {
    expect(requestTimestamp(new Date("2026-11-14T03:00:00.123Z"))).toBe("2026-11-14T03:00:00Z");
  });
});

describe("pengaman konfigurasi go-live", () => {
  it("produksi tanpa DOKU_BASE_URL tidak diam-diam memakai sandbox", () => {
    expect(
      loadDokuConfig({ DOKU_CLIENT_ID: "x", DOKU_SECRET_KEY: "y", VERCEL_ENV: "production" }),
    ).toBeNull();
    const ok = loadDokuConfig({
      DOKU_CLIENT_ID: "x",
      DOKU_SECRET_KEY: "y",
      VERCEL_ENV: "production",
      DOKU_BASE_URL: "https://api.doku.com",
    });
    expect(ok?.baseUrl).toBe("https://api.doku.com");
  });

  it("non-produksi tanpa DOKU_BASE_URL memakai sandbox", () => {
    const cfg = loadDokuConfig({ DOKU_CLIENT_ID: "x", DOKU_SECRET_KEY: "y" });
    expect(cfg?.baseUrl).toBe("https://api-sandbox.doku.com");
    expect(loadDokuConfig({ DOKU_CLIENT_ID: "x" })).toBeNull();
  });

  it("URL notifikasi dikirim di tiap permintaan pembayaran (jaring pengaman)", async () => {
    let captured = "";
    vi.stubGlobal("fetch", async (_url: unknown, init?: { body?: string }) => {
      captured = init?.body ?? "";
      return new Response(
        JSON.stringify({
          response: {
            payment: { url: "https://bayar.example/x", expired_date: "2026-11-16T10:00:00Z" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    try {
      const result = await createCheckoutPayment(
        config,
        {
          invoiceNumber: "INV-1",
          amountIdr: 20000,
          paymentDueMinutes: 15,
          customer: { name: "Tes", phone: "08123456789", address: "Jl. Tes 1", city: "Jakarta" },
          callbackUrl: "https://toko.example/pesanan/INV-1?dari=pembayaran",
          notificationUrl: "https://toko.example/api/webhook/doku",
          lineItems: [{ name: "Kurma", quantity: 1, price: 20000 }],
        },
        new Date("2026-11-16T10:00:00Z"),
      );
      expect(result.paymentUrl).toBe("https://bayar.example/x");
      const body = JSON.parse(captured) as {
        additional_info?: { override_notification_url?: string };
      };
      expect(body.additional_info?.override_notification_url).toBe(
        "https://toko.example/api/webhook/doku",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
