import { describe, expect, it } from "vitest";
import {
  type DokuConfig,
  digestBase64,
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
