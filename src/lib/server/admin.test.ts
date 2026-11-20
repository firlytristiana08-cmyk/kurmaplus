// Tes pintu tulis tunggal Portal Admin (PRD — aturan kode #1..#4):
// perpindahan status, invarian stok & uang, jejak audit, dan validasi.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tempDir = mkdtempSync(path.join(tmpdir(), "kurmaplus-admin-test-"));
process.env.KURMAPLUS_DATA_DIR = tempDir;
process.env.KURMAPLUS_DB = "sqlite";

const db = await import("./db");
const admin = await import("./admin");

const now = new Date("2026-11-16T10:00:00Z");

async function newOrder(code: string, variantId: number, qty: number): Promise<void> {
  const result = await db.createOrder({
    code,
    customerName: "Tes Admin",
    customerPhone: "081200000001",
    address: "Jalan Tes No. 1",
    city: "Jakarta Selatan",
    lat: -6.2,
    lng: 106.8,
    courier: "Grab",
    deliveryDate: "2026-11-21",
    note: null,
    items: [{ variantId, qty }],
    now,
    paymentTimeoutMinutes: 60,
  });
  if (!result.ok) throw new Error("gagal membuat pesanan tes");
}

async function auditFor(code: string): Promise<unknown[]> {
  return admin
    .adminLogList({ entity: "order" })
    .then((entries) => entries.filter((entry) => entry.entityId === code));
}

describe("admin: perpindahan status (BA-01..BA-05)", () => {
  beforeAll(async () => {
    await db.getDb();
    await newOrder("TESTAAAA", 1, 1);
  });

  it("menolak lompatan yang tidak sah (pending_payment → packed)", async () => {
    const result = await admin.adminChangeStatus("TESTAAAA", "packed", { actor: "tes" });
    expect(result.ok).toBe(false);
  });

  it("menandai bayar manual wajib beralasan (BA-02)", async () => {
    const noReason = await admin.adminManualPaid("TESTAAAA", "   ", "tes");
    expect(noReason.ok).toBe(false);
    const ok = await admin.adminManualPaid("TESTAAAA", "transfer diterima", "tes");
    expect(ok.ok).toBe(true);
    const detail = await admin.adminOrderDetail("TESTAAAA");
    expect(detail?.status).toBe("paid");
    expect(detail?.manualPaidReason).toBe("transfer diterima");
  });

  it("maju satu langkah dan mencatat waktu + audit", async () => {
    const result = await admin.adminChangeStatus("TESTAAAA", "packed", {
      actor: "tes",
      now,
    });
    expect(result.ok).toBe(true);
    const detail = await admin.adminOrderDetail("TESTAAAA");
    expect(detail?.status).toBe("packed");
    expect(detail?.packedAt).toBe(now.toISOString());
    const audit = await auditFor("TESTAAAA");
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });

  it("koreksi mundur wajib beralasan (BA-01)", async () => {
    const noReason = await admin.adminChangeStatus("TESTAAAA", "paid", { actor: "tes" });
    expect(noReason.ok).toBe(false);
    const ok = await admin.adminChangeStatus("TESTAAAA", "paid", {
      actor: "tes",
      reason: "salah klik",
    });
    expect(ok.ok).toBe(true);
    const detail = await admin.adminOrderDetail("TESTAAAA");
    expect(detail?.status).toBe("paid");
    expect(detail?.packedAt).toBeNull();
  });

  it("membatalkan dari dikemas mengembalikan stok (BA-03)", async () => {
    const before = await db.getSettings();
    expect(before).toBeTruthy();
    await admin.adminChangeStatus("TESTAAAA", "packed", { actor: "tes", now });
    const stockBefore = await variantStock(1);
    const result = await admin.adminChangeStatus("TESTAAAA", "cancelled", {
      actor: "tes",
      reason: "pembeli batal",
      restoreStock: true,
    });
    expect(result.ok).toBe(true);
    const stockAfter = await variantStock(1);
    expect(stockAfter).toBe(stockBefore + 1);
    const detail = await admin.adminOrderDetail("TESTAAAA");
    expect(detail?.status).toBe("cancelled");
    expect(detail?.cancelledReason).toBe("pembeli batal");
  });

  it("menolak pembatalan dari status dikirim (BA-05)", async () => {
    await newOrder("TESTBBBB", 1, 1);
    await admin.adminManualPaid("TESTBBBB", "tes", "tes");
    await admin.adminChangeStatus("TESTBBBB", "packed", { actor: "tes" });
    await admin.adminChangeStatus("TESTBBBB", "shipped", { actor: "tes" });
    const result = await admin.adminChangeStatus("TESTBBBB", "cancelled", {
      actor: "tes",
      reason: "coba",
    });
    expect(result.ok).toBe(false);
    const detail = await admin.adminOrderDetail("TESTBBBB");
    expect(detail?.status).toBe("shipped");
  });
});

async function variantStock(variantId: number): Promise<number> {
  const dbi = await db.getDb();
  const row = await dbi.get<{ stock: number }>("SELECT stock FROM variants WHERE id = ?", [
    variantId,
  ]);
  return row?.stock ?? -1;
}

describe("admin: stok, ongkir, tanggal, pengaturan", () => {
  beforeAll(async () => {
    await db.getDb();
  });

  it("penyesuaian stok bercatatan dan tidak pernah negatif (BA-08)", async () => {
    const noReason = await admin.adminAdjustStock(2, 5, "  ", "tes");
    expect(noReason.ok).toBe(false);
    const tooMuch = await admin.adminAdjustStock(2, -100000, "habis semua", "tes");
    expect(tooMuch.ok).toBe(false);
    const stockBefore = await variantStock(2);
    const ok = await admin.adminAdjustStock(2, -2, "koreksi opname", "tes");
    expect(ok.ok).toBe(true);
    expect(await variantStock(2)).toBe(stockBefore - 2);
  });

  it("ongkir: nominal divalidasi dan status berubah (BA-06)", async () => {
    await newOrder("TESTCCCC", 1, 1);
    const badAmount = await admin.adminSetShipping("TESTCCCC", { shippingActualIdr: -5 }, "tes");
    expect(badAmount.ok).toBe(false);
    const ok = await admin.adminSetShipping(
      "TESTCCCC",
      { shippingActualIdr: 25000, courierBooked: true, shippingStatus: "booked" },
      "tes",
    );
    expect(ok.ok).toBe(true);
    const detail = await admin.adminOrderDetail("TESTCCCC");
    expect(detail?.shippingStatus).toBe("booked");
    expect(detail?.shippingActualIdr).toBe(25000);
    expect(detail?.courierBookedAt).toBeTruthy();
  });

  it("pindah tanggal hanya Sabtu/Minggu dengan catatan (BA-07)", async () => {
    const weekday = await admin.adminMoveDelivery("TESTCCCC", "2026-11-18", "rabu", "tes");
    expect(weekday.ok).toBe(false);
    const noNote = await admin.adminMoveDelivery("TESTCCCC", "2026-11-22", "", "tes");
    expect(noNote.ok).toBe(false);
    const ok = await admin.adminMoveDelivery("TESTCCCC", "2026-11-22", "permintaan pembeli", "tes");
    expect(ok.ok).toBe(true);
    const detail = await admin.adminOrderDetail("TESTCCCC");
    expect(detail?.deliveryDate).toBe("2026-11-22");
  });

  it("pengaturan tervalidasi dan tercatat di audit (AD-20, BA-12)", async () => {
    const badTemplate = await admin.adminUpdateSettings(
      { wa_templates: '{"konfirmasi":42}' },
      "tes",
    );
    expect(badTemplate.ok).toBe(false);
    const ok = await admin.adminUpdateSettings(
      {
        low_stock_threshold: "12",
        wa_templates: JSON.stringify({
          konfirmasi: "Halo {nama}",
          tagih_ongkir: "Ongkir {nominal}",
          pindah_tanggal: "Pindah {tanggal}",
        }),
      },
      "tes",
    );
    expect(ok.ok).toBe(true);
    const settings = await db.getSettings();
    expect(settings.low_stock_threshold).toBe("12");
  });

  it("tutup toko menonaktifkan checkout (BA-10)", async () => {
    const ok = await admin.adminToggleStore(false, "tes");
    expect(ok.ok).toBe(true);
    const settings = await db.getSettings();
    expect(settings.store_open).toBe("0");
    await admin.adminToggleStore(true, "tes");
  });

  it("beranda: stok menipis memakai ambang pengaturan (AD-03)", async () => {
    const today = await admin.adminToday(new Date("2026-11-16T02:00:00Z"));
    expect(today.threshold).toBe(12);
    expect(today.lowStock.length).toBeGreaterThan(0);
    expect(today.lowStock.every((row) => row.stock < 12)).toBe(true);
  });

  it("laporan menghitung omzet tanpa ongkir (AD-21, BA-06)", async () => {
    const report = await admin.adminReport("2026-11-01", "2026-11-30");
    expect(report.orderCount).toBeGreaterThan(0);
    expect(report.omzetIdr).toBeGreaterThan(0);
  });

  it("seed database baru: foto produk legacy tersalin ke galeri", async () => {
    const dbi = await db.getDb();
    const rows = await dbi.all<{ data: string }>(
      "SELECT data FROM product_photos WHERE product_id = 1 ORDER BY sort_order, id",
      [],
    );
    expect(rows.map((row) => row.data)).toEqual(["sukari.webp", "sukari-2.webp", "sukari-3.webp"]);
  });

  it("produk: tambah & hapus permanen — riwayat pesanan tetap utuh", async () => {
    const created = await admin.adminCreateProduct(
      {
        name: "Produk Tes Hapus",
        description: "Hanya untuk tes.",
        photos: [{ sm: "", md: "", lg: "data:image/webp;base64,AAAA" }],
        variants: [{ label: "1 kg", weightGrams: 1000, priceIdr: 50000, stock: 2 }],
      },
      "tes",
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await newOrder("TESTHPS1", created.variantIds[0], 1);
    const removed = await admin.adminDeleteProduct(created.productId, "tes", now);
    expect(removed.ok).toBe(true);
    const detail = await admin.adminOrderDetail("TESTHPS1");
    expect(detail?.items.length).toBe(1);
    expect((detail?.items[0].name ?? "").length).toBeGreaterThan(0);
    const again = await admin.adminDeleteProduct(created.productId, "tes", now);
    expect(again.ok).toBe(false);
  });
});

describe("admin: manajemen detail produk & varian (tugas 90)", () => {
  beforeAll(async () => {
    await db.getDb();
  });

  // Penghapusan direktori tes hanya sekali di akhir berkas — menghapus di
  // tengah membuat koneksi SQLite tersisa menjadi read-only.
  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detail produk keseluruhan bisa diubah dan tercatat di audit", async () => {
    const ok = await admin.adminUpdateProduct(
      1,
      {
        name: "Kurma Sukari Premium",
        description: "Deskripsi baru hasil suntingan admin.",
        sortOrder: 7,
        isBestSeller: true,
      },
      "tes",
      now,
    );
    expect(ok.ok).toBe(true);
    const dbi = await db.getDb();
    const row = await dbi.get<{
      name: string;
      description: string;
      sort_order: number;
      is_best_seller: number;
    }>("SELECT name, description, sort_order, is_best_seller FROM products WHERE id = 1", []);
    expect(row?.name).toBe("Kurma Sukari Premium");
    expect(row?.sort_order).toBe(7);
    expect(row?.is_best_seller).toBe(1);
    const added = await admin.adminAddProductPhotos(
      1,
      [{ sm: "", md: "", lg: "data:image/webp;base64,AAAA" }],
      "tes",
      now,
    );
    expect(added.ok).toBe(true);
    const photo = await dbi.get<{ id: number; data: string }>(
      "SELECT id, data FROM product_photos WHERE product_id = 1 ORDER BY id DESC LIMIT 1",
      [],
    );
    expect(photo?.data).toBe("data:image/webp;base64,AAAA");
    const removedPhoto = await admin.adminDeleteProductPhoto(photo?.id ?? 0, "tes", now);
    expect(removedPhoto.ok).toBe(true);
    const invalid = await admin.adminUpdateProduct(1, { name: "  " }, "tes", now);
    expect(invalid.ok).toBe(false);
  });

  it("nama dan berat varian bisa diubah", async () => {
    const ok = await admin.adminUpdateVariant(
      1,
      { label: "500 gram", weightGrams: 550 },
      "tes",
      now,
    );
    expect(ok.ok).toBe(true);
    const dbi = await db.getDb();
    const row = await dbi.get<{ label: string; weight_grams: number }>(
      "SELECT label, weight_grams FROM variants WHERE id = 1",
      [],
    );
    expect(row?.label).toBe("500 gram");
    expect(row?.weight_grams).toBe(550);
    const bad = await admin.adminUpdateVariant(1, { weightGrams: 0 }, "tes", now);
    expect(bad.ok).toBe(false);
  });

  it("varian baru bisa ditambah; hapus terlindungi bila ada riwayat", async () => {
    const created = await admin.adminCreateVariant(
      2,
      { label: "2 kg", weightGrams: 2000, priceIdr: 500000, stock: 3 },
      "tes",
      now,
    );
    expect(created.ok).toBe(true);
    const dbi = await db.getDb();
    const row = await dbi.get<{ id: number; stock: number }>(
      "SELECT id, stock FROM variants WHERE product_id = 2 AND label = '2 kg'",
      [],
    );
    expect(row?.stock).toBe(3);
    // Varian yang sudah punya riwayat pesanan tidak boleh dihapus.
    const blockedOrder = await admin.adminDeleteVariant(1, "tes", now);
    expect(blockedOrder.ok).toBe(false);
    // Varian baru dengan stok awal punya riwayat pergerakan — juga dilindungi.
    const blockedMove = await admin.adminDeleteVariant(row?.id ?? -1, "tes", now);
    expect(blockedMove.ok).toBe(false);
    // Varian tanpa riwayat apa pun boleh dihapus bersih.
    const clean = await admin.adminCreateVariant(
      2,
      { label: "Uji bersih", weightGrams: 1, priceIdr: 1000, stock: 0 },
      "tes",
      now,
    );
    expect(clean.ok).toBe(true);
    const cleanRow = await dbi.get<{ id: number }>(
      "SELECT id FROM variants WHERE product_id = 2 AND label = 'Uji bersih'",
      [],
    );
    const deleted = await admin.adminDeleteVariant(cleanRow?.id ?? -1, "tes", now);
    expect(deleted.ok).toBe(true);
  });
});
