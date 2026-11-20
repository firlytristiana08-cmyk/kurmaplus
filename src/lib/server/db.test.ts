import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tempDir = mkdtempSync(path.join(tmpdir(), "kurmaplus-test-"));
process.env.KURMAPLUS_DATA_DIR = tempDir;
// Tes memakai database lokal supaya deterministik tanpa jaringan.
process.env.KURMAPLUS_DB = "sqlite";

const db = await import("./db");

const now = new Date("2026-11-11T10:00:00Z");

function makeOrder(code: string, variantId: number, qty: number) {
  return db.createOrder({
    code,
    customerName: "Budi Santoso",
    customerPhone: "6281234567890",
    address: "Jalan Kenanga 12",
    city: "Kota Depok",
    lat: -6.4,
    lng: 106.8,
    courier: "Grab",
    deliveryDate: "2026-11-14",
    note: null,
    items: [{ variantId, qty }],
    now,
    paymentTimeoutMinutes: 60,
  });
}

describe("db: stok, pembayaran, kedaluwarsa (BR-09, BR-11..BR-13, FR-09..FR-13)", () => {
  beforeAll(async () => {
    await db.getDb();
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("mengunci stok saat pesanan dibuat", async () => {
    const before = (await db.getProductBySlug("sukari"))?.variants[0]?.stock ?? -1;
    const result = await makeOrder("ORDER001", 1, 2);
    expect(result.ok).toBe(true);
    const after = (await db.getProductBySlug("sukari"))?.variants[0]?.stock ?? -1;
    expect(after).toBe(before - 2);
  });

  it("menolak pesanan saat stok kurang dan tidak mengubah stok", async () => {
    const before = (await db.getProductBySlug("ajwa"))?.variants[2]?.stock ?? -1;
    const result = await makeOrder("ORDER002", 6, before + 1);
    expect(result).toMatchObject({ ok: false, reason: "stock" });
    const after = (await db.getProductBySlug("ajwa"))?.variants[2]?.stock ?? -1;
    expect(after).toBe(before);
  });

  it("status berubah sekali walau notifikasi berulang", async () => {
    expect(await db.markPaidByInvoice("ORDER001", now)).toBe(true);
    expect(await db.markPaidByInvoice("ORDER001", now)).toBe(false);
    expect((await db.getOrderByCode("ORDER001"))?.status).toBe("paid");
  });

  it("event webhook ganda hanya diproses sekali", async () => {
    expect(await db.recordWebhookEvent("req-duplikat", now)).toBe(true);
    expect(await db.recordWebhookEvent("req-duplikat", now)).toBe(false);
  });

  it("pesanan kedaluwarsa mengembalikan stok", async () => {
    const before = (await db.getProductBySlug("tunisia"))?.variants[0]?.stock ?? -1;
    const result = await makeOrder("ORDER003", 7, 3);
    expect(result.ok).toBe(true);
    expect((await db.getProductBySlug("tunisia"))?.variants[0]?.stock).toBe(before - 3);

    const future = new Date("2026-11-11T12:00:00Z");
    expect(await db.expireStaleOrders(future)).toBe(1);
    expect((await db.getOrderByCode("ORDER003"))?.status).toBe("expired");
    expect((await db.getProductBySlug("tunisia"))?.variants[0]?.stock).toBe(before);
  });

  it("notifikasi kedaluwarsa DOKU menutup pesanan yang masih menunggu bayar", async () => {
    const before = (await db.getProductBySlug("ajwa"))?.variants[0]?.stock ?? -1;
    const result = await makeOrder("ORDER004", 4, 2);
    expect(result.ok).toBe(true);
    // Lunas tidak boleh diturunkan oleh notifikasi kedaluwarsa.
    expect(await db.expireOrderByInvoice("ORDER001", now)).toBe(false);
    expect((await db.getOrderByCode("ORDER001"))?.status).toBe("paid");
    expect(await db.expireOrderByInvoice("ORDER004", now)).toBe(true);
    expect((await db.getOrderByCode("ORDER004"))?.status).toBe("expired");
    expect((await db.getProductBySlug("ajwa"))?.variants[0]?.stock).toBe(before);
    // Idempoten: notifikasi kedua tidak mengubah apa pun.
    expect(await db.expireOrderByInvoice("ORDER004", now)).toBe(false);
  });

  it("lacak hanya cocok dengan kode dan 4 digit terakhir WhatsApp", async () => {
    expect((await db.findOrderByCodeAndPhoneTail("ORDER001", "7890"))?.code).toBe("ORDER001");
    expect(await db.findOrderByCodeAndPhoneTail("ORDER001", "0000")).toBeNull();
    expect(await db.findOrderByCodeAndPhoneTail("TIDAKADA", "7890")).toBeNull();
  });
});
