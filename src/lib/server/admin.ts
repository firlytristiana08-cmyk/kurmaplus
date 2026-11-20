// Pintu tulis tunggal Portal Admin (PRD Portal Admin — aturan kode #2):
// semua perubahan data admin berjalan lewat fungsi-fungsi di berkas ini, yang
// menulis perubahan + stock_movements + audit_log dalam SATU transaksi, dengan
// validasi perpindahan status (BA-01..BA-05). Halaman tidak menulis langsung
// ke tabel. Berjalan di atas dua driver (SQLite pratinjau / Postgres produksi).

import type { Db } from "./db";
import { getDb, getSettings } from "./db";
import type { OrderStatus } from "./orders";

export type AdminResult = { ok: true } | { ok: false; error: string };

function fail(error: string): AdminResult {
  return { ok: false, error };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------- Audit ----------

interface AuditInput {
  actor: string;
  entity: "order" | "variant" | "product" | "settings" | "export";
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  at: string;
}

async function writeAudit(tx: Db, input: AuditInput): Promise<void> {
  await tx.run(
    "INSERT INTO audit_log (id, actor, entity, entity_id, action, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      crypto.randomUUID(),
      input.actor,
      input.entity,
      input.entityId,
      input.action,
      input.before === null || input.before === undefined ? null : JSON.stringify(input.before),
      input.after === null || input.after === undefined ? null : JSON.stringify(input.after),
      input.at,
    ],
  );
}

export interface AuditEntry {
  id: string;
  actor: string;
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------- Status pesanan (BA-01..BA-05) ----------

// Maju satu langkah; koreksi mundur satu langkah untuk paid/packed/shipped/done.
const FORWARD: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "packed",
  packed: "shipped",
  shipped: "done",
};
const BACKWARD: Partial<Record<OrderStatus, OrderStatus>> = {
  packed: "paid",
  shipped: "packed",
  done: "shipped",
};

export function allowedStatusActions(status: OrderStatus): {
  forward: OrderStatus | null;
  backward: OrderStatus | null;
  canCancel: boolean;
  canManualPaid: boolean;
} {
  return {
    forward: FORWARD[status] ?? null,
    backward: BACKWARD[status] ?? null,
    canCancel: status === "paid" || status === "packed",
    canManualPaid: status === "pending_payment",
  };
}

interface StatusChangeOptions {
  actor: string;
  reason?: string | null;
  restoreStock?: boolean;
  now?: Date;
}

async function stockReturn(
  tx: Db,
  orderId: number,
  reason: "cancel_return" | "expire_return",
  actor: string,
  at: string,
): Promise<void> {
  const items = await tx.all<{ variant_id: number; qty: number }>(
    "SELECT variant_id, qty FROM order_items WHERE order_id = ?",
    [orderId],
  );
  for (const item of items) {
    await tx.run("UPDATE variants SET stock = stock + ? WHERE id = ?", [item.qty, item.variant_id]);
    await tx.run(
      "INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), item.variant_id, item.qty, reason, orderId, actor, at],
    );
  }
}

export async function adminChangeStatus(
  code: string,
  to: OrderStatus,
  options: StatusChangeOptions,
): Promise<AdminResult> {
  const db = await getDb();
  const now = (options.now ?? new Date()).toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{
      id: number;
      status: OrderStatus;
      delivery_date: string;
      total_idr: number;
    }>("SELECT id, status, delivery_date, total_idr FROM orders WHERE code = ?", [code]);
    if (!row) return fail("Pesanan tidak ditemukan.");
    const from = row.status;
    if (from === to) return fail("Status sudah demikian.");

    if (to === "cancelled") {
      // BA-03: hanya dari dibayar atau dikemas; alasan wajib.
      if (from !== "paid" && from !== "packed") {
        return fail("Pembatalan hanya dari status Dibayar atau Dikemas.");
      }
      const reason = (options.reason ?? "").trim();
      if (reason === "") return fail("Alasan pembatalan wajib diisi.");
      const restore = options.restoreStock !== false;
      if (restore) {
        await stockReturn(tx, row.id, "cancel_return", options.actor, now);
      }
      await tx.run("UPDATE orders SET status = 'cancelled', cancelled_reason = ? WHERE id = ?", [
        reason,
        row.id,
      ]);
      await writeAudit(tx, {
        actor: options.actor,
        entity: "order",
        entityId: code,
        action: "order_cancelled",
        before: { status: from },
        after: { status: "cancelled", reason, stock_restored: restore },
        at: now,
      });
      return { ok: true as const };
    }

    if (to === "expired") return fail("Kedaluwarsa diurus sistem, bukan admin.");

    const forward = FORWARD[from] === to;
    const backward = BACKWARD[from] === to;
    if (!forward && !backward) {
      return fail(`Perpindahan ${from} → ${to} tidak sah.`);
    }
    if (backward && !(options.reason ?? "").trim()) {
      return fail("Koreksi mundur wajib disertai alasan.");
    }

    // Waktu tiap langkah maju; dikosongkan saat dikoreksi mundur.
    const timePatch =
      to === "packed"
        ? "packed_at = ?, shipped_at = NULL, done_at = NULL"
        : to === "shipped"
          ? "shipped_at = ?, done_at = NULL"
          : to === "done"
            ? "done_at = ?"
            : to === "paid"
              ? "packed_at = NULL, shipped_at = NULL, done_at = NULL"
              : "1 = 1";
    const params: (string | number)[] = [];
    if (to === "packed" || to === "shipped" || to === "done") params.push(now);
    params.push(row.id);
    await tx.run(`UPDATE orders SET status = ?, ${timePatch} WHERE id = ?`, [to, ...params]);
    await writeAudit(tx, {
      actor: options.actor,
      entity: "order",
      entityId: code,
      action: "status_changed",
      before: { status: from },
      after: {
        status: to,
        direction: forward ? "forward" : "back",
        reason: (options.reason ?? "").trim() || null,
      },
      at: now,
    });
    return { ok: true as const };
  });
}

export async function adminManualPaid(
  code: string,
  reason: string,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  const trimmed = reason.trim();
  if (trimmed === "") return fail("Alasan penandaan manual wajib diisi (BA-02).");
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{ id: number; status: OrderStatus }>(
      "SELECT id, status FROM orders WHERE code = ?",
      [code],
    );
    if (!row) return fail("Pesanan tidak ditemukan.");
    if (row.status !== "pending_payment") return fail("Hanya pesanan menunggu bayar.");
    await tx.run(
      "UPDATE orders SET status = 'paid', paid_at = ?, manual_paid_reason = ? WHERE id = ?",
      [at, trimmed, row.id],
    );
    await tx.run("UPDATE payments SET status = 'success' WHERE order_id = ?", [row.id]);
    await writeAudit(tx, {
      actor,
      entity: "order",
      entityId: code,
      action: "manual_paid",
      before: { status: "pending_payment" },
      after: { status: "paid", reason: trimmed },
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Ongkir (BA-06) ----------

export type ShippingStatus = "not_booked" | "booked" | "billed" | "paid";
const SHIPPING_STATUSES: ShippingStatus[] = ["not_booked", "booked", "billed", "paid"];

export interface ShippingPatch {
  shippingStatus?: ShippingStatus;
  shippingActualIdr?: number | null;
  courierBooked?: boolean;
}

export async function adminSetShipping(
  code: string,
  patch: ShippingPatch,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  if (patch.shippingStatus !== undefined && !SHIPPING_STATUSES.includes(patch.shippingStatus)) {
    return fail("Status ongkir tidak dikenal.");
  }
  if (
    patch.shippingActualIdr !== undefined &&
    patch.shippingActualIdr !== null &&
    (!Number.isInteger(patch.shippingActualIdr) || patch.shippingActualIdr < 0)
  ) {
    return fail("Nominal ongkir harus bilangan bulat ≥ 0.");
  }
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{
      id: number;
      shipping_status: string;
      shipping_actual_idr: number | null;
      courier_booked_at: string | null;
    }>(
      "SELECT id, shipping_status, shipping_actual_idr, courier_booked_at FROM orders WHERE code = ?",
      [code],
    );
    if (!row) return fail("Pesanan tidak ditemukan.");
    const before = {
      shipping_status: row.shipping_status,
      shipping_actual_idr: row.shipping_actual_idr,
      courier_booked_at: row.courier_booked_at,
    };
    const nextStatus = patch.shippingStatus ?? row.shipping_status;
    const nextAmount =
      patch.shippingActualIdr !== undefined ? patch.shippingActualIdr : row.shipping_actual_idr;
    const nextBookedAt = patch.courierBooked ? at : row.courier_booked_at;
    await tx.run(
      "UPDATE orders SET shipping_status = ?, shipping_actual_idr = ?, courier_booked_at = ? WHERE id = ?",
      [nextStatus, nextAmount, nextBookedAt, row.id],
    );
    await writeAudit(tx, {
      actor,
      entity: "order",
      entityId: code,
      action: "shipping_updated",
      before,
      after: {
        shipping_status: nextStatus,
        shipping_actual_idr: nextAmount,
        courier_booked_at: nextBookedAt,
      },
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Tanggal kirim (BA-07) ----------

export async function adminMoveDelivery(
  code: string,
  date: string,
  note: string,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Tanggal harus berformat YYYY-MM-DD.");
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday !== 0 && weekday !== 6) return fail("Tanggal kirim hanya Sabtu atau Minggu.");
  const trimmed = note.trim();
  if (trimmed === "") return fail("Catatan pemindahan wajib diisi.");
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{ id: number; delivery_date: string }>(
      "SELECT id, delivery_date FROM orders WHERE code = ?",
      [code],
    );
    if (!row) return fail("Pesanan tidak ditemukan.");
    await tx.run("UPDATE orders SET delivery_date = ? WHERE id = ?", [date, row.id]);
    await writeAudit(tx, {
      actor,
      entity: "order",
      entityId: code,
      action: "delivery_moved",
      before: { delivery_date: row.delivery_date },
      after: { delivery_date: date, note: trimmed },
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Catatan internal & pengembalian dana (AD-11, BA-04) ----------

export async function adminSaveNote(
  code: string,
  note: string,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await tx.get<{ id: number; internal_note: string | null }>(
      "SELECT id, internal_note FROM orders WHERE code = ?",
      [code],
    );
    if (!row) return fail("Pesanan tidak ditemukan.");
    await tx.run("UPDATE orders SET internal_note = ? WHERE id = ?", [note.trim() || null, row.id]);
    await writeAudit(tx, {
      actor,
      entity: "order",
      entityId: code,
      action: "internal_note_saved",
      before: { internal_note: row.internal_note },
      after: { internal_note: note.trim() || null },
      at: now.toISOString(),
    });
    return { ok: true as const };
  });
}

export async function adminNoteRefund(
  code: string,
  note: string,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  const trimmed = note.trim();
  if (trimmed === "") return fail("Catatan pengembalian dana wajib diisi.");
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{ id: number }>("SELECT id FROM orders WHERE code = ?", [code]);
    if (!row) return fail("Pesanan tidak ditemukan.");
    await tx.run("UPDATE orders SET refund_noted_at = ?, refund_note = ? WHERE id = ?", [
      at,
      trimmed,
      row.id,
    ]);
    await writeAudit(tx, {
      actor,
      entity: "order",
      entityId: code,
      action: "refund_noted",
      before: null,
      after: { refund_at: isoDate(new Date(at)), note: trimmed },
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Stok (BA-08) ----------

export async function adminAdjustStock(
  variantId: number,
  delta: number,
  reason: string,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  if (!Number.isInteger(delta) || delta === 0)
    return fail("Selisih stok harus bilangan bulat selain nol.");
  const trimmed = reason.trim();
  if (trimmed === "") return fail("Alasan penyesuaian stok wajib diisi.");
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{ id: number; stock: number }>(
      "SELECT id, stock FROM variants WHERE id = ?",
      [variantId],
    );
    if (!row) return fail("Varian tidak ditemukan.");
    const next = row.stock + delta;
    if (next < 0) return fail("Stok tidak boleh negatif.");
    await tx.run("UPDATE variants SET stock = ? WHERE id = ?", [next, variantId]);
    await tx.run(
      "INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, actor, created_at) VALUES (?, ?, ?, 'adjustment', NULL, ?, ?)",
      [crypto.randomUUID(), variantId, delta, actor, at],
    );
    await writeAudit(tx, {
      actor,
      entity: "variant",
      entityId: String(variantId),
      action: "stock_adjusted",
      before: { stock: row.stock },
      after: { stock: next, delta, reason: trimmed },
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Produk & varian (AD-18, BA-09) ----------

export interface VariantPatch {
  label?: string;
  weightGrams?: number;
  priceIdr?: number;
  isActive?: boolean;
}

export async function adminUpdateVariant(
  variantId: number,
  patch: VariantPatch,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  if (patch.label !== undefined && patch.label.trim() === "") {
    return fail("Nama ukuran wajib diisi.");
  }
  if (
    patch.weightGrams !== undefined &&
    (!Number.isInteger(patch.weightGrams) || patch.weightGrams <= 0)
  ) {
    return fail("Berat harus bilangan bulat lebih dari nol (gram).");
  }
  if (patch.priceIdr !== undefined && (!Number.isInteger(patch.priceIdr) || patch.priceIdr <= 0)) {
    return fail("Harga harus rupiah bulat lebih dari nol.");
  }
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{
      id: number;
      label: string;
      weight_grams: number;
      price_idr: number;
      is_active: number;
    }>("SELECT id, label, weight_grams, price_idr, is_active FROM variants WHERE id = ?", [
      variantId,
    ]);
    if (!row) return fail("Varian tidak ditemukan.");
    const after = {
      label: patch.label?.trim() ?? row.label,
      weight_grams: patch.weightGrams ?? row.weight_grams,
      price_idr: patch.priceIdr ?? row.price_idr,
      is_active: patch.isActive === undefined ? row.is_active : patch.isActive ? 1 : 0,
    };
    await tx.run(
      "UPDATE variants SET label = ?, weight_grams = ?, price_idr = ?, is_active = ? WHERE id = ?",
      [after.label, after.weight_grams, after.price_idr, after.is_active, variantId],
    );
    await writeAudit(tx, {
      actor,
      entity: "variant",
      entityId: String(variantId),
      action: "variant_updated",
      before: {
        label: row.label,
        weight_grams: row.weight_grams,
        price_idr: row.price_idr,
        is_active: row.is_active,
      },
      after,
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Tambah & hapus varian (tugas 90) ----------

export interface NewVariantInput {
  label: string;
  weightGrams: number;
  priceIdr: number;
  stock: number;
}

export async function adminCreateVariant(
  productId: number,
  input: NewVariantInput,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  if (input.label.trim() === "") return fail("Nama ukuran wajib diisi.");
  if (!Number.isInteger(input.weightGrams) || input.weightGrams <= 0) {
    return fail("Berat harus bilangan bulat lebih dari nol (gram).");
  }
  if (!Number.isInteger(input.priceIdr) || input.priceIdr <= 0) {
    return fail("Harga harus rupiah bulat lebih dari nol.");
  }
  if (!Number.isInteger(input.stock) || input.stock < 0) {
    return fail("Stok awal tidak boleh negatif.");
  }
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const product = await tx.get<{ id: number }>("SELECT id FROM products WHERE id = ?", [
      productId,
    ]);
    if (!product) return fail("Produk tidak ditemukan.");
    // id dibuat dari MAX(id)+1 agar aman di SQLite maupun Postgres.
    const created = await tx.get<{ id: number }>(
      "SELECT COALESCE(MAX(id), 0) + 1 AS id FROM variants",
      [],
    );
    const variantId = created?.id ?? 1;
    await tx.run(
      "INSERT INTO variants (id, product_id, label, weight_grams, price_idr, stock, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
      [variantId, productId, input.label.trim(), input.weightGrams, input.priceIdr, input.stock],
    );
    if (input.stock > 0) {
      await tx.run(
        "INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, actor, created_at) VALUES (?, ?, ?, 'stock_initial', NULL, ?, ?)",
        [crypto.randomUUID(), variantId, input.stock, actor, at],
      );
    }
    await writeAudit(tx, {
      actor,
      entity: "variant",
      entityId: String(variantId),
      action: "variant_created",
      before: null,
      after: {
        product_id: productId,
        label: input.label.trim(),
        weight_grams: input.weightGrams,
        price_idr: input.priceIdr,
        stock: input.stock,
      },
      at,
    });
    return { ok: true as const };
  });
}

export async function adminDeleteVariant(
  variantId: number,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{ id: number; product_id: number; label: string; stock: number }>(
      "SELECT id, product_id, label, stock FROM variants WHERE id = ?",
      [variantId],
    );
    if (!row) return fail("Varian tidak ditemukan.");
    const used = await tx.get<{ orders: number; moves: number }>(
      `SELECT
        (SELECT COUNT(*) FROM order_items WHERE variant_id = ?) AS orders,
        (SELECT COUNT(*) FROM stock_movements WHERE variant_id = ?) AS moves`,
      [variantId, variantId],
    );
    if ((used?.orders ?? 0) > 0 || (used?.moves ?? 0) > 0) {
      return fail(
        "Varian sudah punya riwayat pesanan atau stok — arsip harus tetap utuh, gunakan Nonaktifkan.",
      );
    }
    await tx.run("DELETE FROM variants WHERE id = ?", [variantId]);
    await writeAudit(tx, {
      actor,
      entity: "variant",
      entityId: String(variantId),
      action: "variant_deleted",
      before: { product_id: row.product_id, label: row.label, stock: row.stock },
      after: null,
      at,
    });
    return { ok: true as const };
  });
}

export interface ProductPatch {
  isActive?: boolean;
  name?: string;
  description?: string;
  photo?: string | null;
  photo2?: string | null;
  photo3?: string | null;
  sortOrder?: number;
  isBestSeller?: boolean;
}

export async function adminUpdateProduct(
  productId: number,
  patch: ProductPatch,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  if (patch.name !== undefined && patch.name.trim() === "") return fail("Nama produk wajib diisi.");
  if (patch.description !== undefined && patch.description.trim() === "") {
    return fail("Deskripsi wajib diisi.");
  }
  for (const value of [patch.photo, patch.photo2, patch.photo3]) {
    if (value !== undefined && value !== null && value.length > 200) {
      return fail("Nama berkas foto maksimal 200 karakter.");
    }
  }
  if (
    patch.sortOrder !== undefined &&
    (!Number.isInteger(patch.sortOrder) || patch.sortOrder < 0)
  ) {
    return fail("Urutan tampil harus bilangan bulat tidak negatif.");
  }
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.get<{
      id: number;
      name: string;
      description: string;
      photo: string | null;
      photo_2: string | null;
      photo_3: string | null;
      sort_order: number;
      is_active: number;
      is_best_seller: number;
    }>(
      "SELECT id, name, description, photo, photo_2, photo_3, sort_order, is_active, is_best_seller FROM products WHERE id = ?",
      [productId],
    );
    if (!row) return fail("Produk tidak ditemukan.");
    const after = {
      name: patch.name?.trim() ?? row.name,
      description: patch.description?.trim() ?? row.description,
      photo: patch.photo === undefined ? row.photo : patch.photo?.trim() || null,
      photo_2: patch.photo2 === undefined ? row.photo_2 : patch.photo2?.trim() || null,
      photo_3: patch.photo3 === undefined ? row.photo_3 : patch.photo3?.trim() || null,
      sort_order: patch.sortOrder ?? row.sort_order,
      is_active: patch.isActive === undefined ? row.is_active : patch.isActive ? 1 : 0,
      is_best_seller:
        patch.isBestSeller === undefined ? row.is_best_seller : patch.isBestSeller ? 1 : 0,
    };
    await tx.run(
      "UPDATE products SET name = ?, description = ?, photo = ?, photo_2 = ?, photo_3 = ?, sort_order = ?, is_active = ?, is_best_seller = ? WHERE id = ?",
      [
        after.name,
        after.description,
        after.photo,
        after.photo_2,
        after.photo_3,
        after.sort_order,
        after.is_active,
        after.is_best_seller,
        productId,
      ],
    );
    await writeAudit(tx, {
      actor,
      entity: "product",
      entityId: String(productId),
      action: "product_updated",
      before: {
        name: row.name,
        description: row.description,
        photo: row.photo,
        photo_2: row.photo_2,
        photo_3: row.photo_3,
        sort_order: row.sort_order,
        is_active: row.is_active,
        is_best_seller: row.is_best_seller,
      },
      after,
      at,
    });
    return { ok: true as const };
  });
}

// ---------- Pengaturan toko (AD-20, BA-10, BA-11) ----------

export const SETTING_KEYS = [
  "store_open",
  "closed_dates",
  "shop_whatsapp",
  "shipping_info_text",
  "low_stock_threshold",
  "wa_templates",
  "notify_chat_id",
  "order_cutoff_weekday",
  "order_cutoff_time",
  "payment_timeout_minutes",
  "daily_capacity",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export function validateSettings(patch: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(patch)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) return `Kunci "${key}" tidak dikenal.`;
    switch (key) {
      case "store_open":
        if (value !== "0" && value !== "1") return "store_open harus 0 atau 1.";
        break;
      case "closed_dates": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          return "closed_dates harus JSON daftar tanggal.";
        }
        if (
          !Array.isArray(parsed) ||
          parsed.some((d) => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))
        ) {
          return "closed_dates harus daftar tanggal YYYY-MM-DD.";
        }
        break;
      }
      case "shop_whatsapp":
        if (!/^\d{8,15}$/.test(value)) return "Nomor WhatsApp harus digit 8–15 (format 62…).";
        break;
      case "shipping_info_text":
        if (value.length > 300) return "Teks info ongkir maksimal 300 karakter.";
        break;
      case "low_stock_threshold":
        if (!/^\d+$/.test(value)) return "Ambang stok menipis harus bilangan bulat ≥ 0.";
        break;
      case "wa_templates": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          return "wa_templates harus JSON.";
        }
        const obj = parsed as Record<string, unknown>;
        if (
          typeof obj !== "object" ||
          obj === null ||
          ["konfirmasi", "tagih_ongkir", "pindah_tanggal"].some((k) => typeof obj[k] !== "string")
        ) {
          return "wa_templates harus memuat konfirmasi, tagih_ongkir, dan pindah_tanggal.";
        }
        if (Object.values(obj).some((v) => typeof v === "string" && v.length > 500)) {
          return "Setiap templat maksimal 500 karakter.";
        }
        break;
      }
      case "order_cutoff_weekday": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 7) return "Batas pesan (hari) harus 1–7.";
        break;
      }
      case "order_cutoff_time":
        if (!/^\d{2}:\d{2}$/.test(value)) return "Batas pesan (jam) harus HH:MM.";
        break;
      case "payment_timeout_minutes":
      case "daily_capacity":
        if (!/^\d+$/.test(value) || Number(value) < 1) return `${key} harus bilangan bulat ≥ 1.`;
        break;
      default:
        break;
    }
  }
  return null;
}

export async function adminUpdateSettings(
  patch: Record<string, string>,
  actor: string,
  now = new Date(),
): Promise<AdminResult> {
  const invalid = validateSettings(patch);
  if (invalid) return fail(invalid);
  const db = await getDb();
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const before: Record<string, string> = {};
    for (const key of Object.keys(patch)) {
      const row = await tx.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
        key,
      ]);
      before[key] = row?.value ?? "";
      await tx.run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        [key, patch[key]],
      );
    }
    await writeAudit(tx, {
      actor,
      entity: "settings",
      entityId: Object.keys(patch).sort().join(","),
      action: "settings_updated",
      before,
      after: patch,
      at,
    });
    return { ok: true as const };
  });
}

export async function adminToggleStore(open: boolean, actor: string): Promise<AdminResult> {
  return adminUpdateSettings({ store_open: open ? "1" : "0" }, actor);
}

// ---------- Pembacaan untuk halaman ----------

export interface AdminOrderLine {
  code: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryDate: string;
  courier: string;
  totalIdr: number;
  createdAt: string;
  shippingStatus: string;
  shippingActualIdr: number | null;
}

interface AdminOrderRow {
  code: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  city: string;
  delivery_date: string;
  courier: string;
  total_idr: number;
  created_at: string;
  shipping_status: string;
  shipping_actual_idr: number | null;
}

function toLine(row: AdminOrderRow): AdminOrderLine {
  return {
    code: row.code,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    city: row.city,
    deliveryDate: row.delivery_date,
    courier: row.courier,
    totalIdr: row.total_idr,
    createdAt: row.created_at,
    shippingStatus: row.shipping_status,
    shippingActualIdr: row.shipping_actual_idr,
  };
}

export interface OrderFilter {
  status?: string;
  deliveryDate?: string;
  courier?: string;
  shippingStatus?: string;
  q?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function adminListOrders(filter: OrderFilter): Promise<{
  rows: AdminOrderLine[];
  total: number;
  page: number;
  pages: number;
}> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.deliveryDate) {
    where.push("delivery_date = ?");
    params.push(filter.deliveryDate);
  }
  if (filter.courier) {
    where.push("courier = ?");
    params.push(filter.courier);
  }
  if (filter.shippingStatus) {
    where.push("shipping_status = ?");
    params.push(filter.shippingStatus);
  }
  if (filter.q && filter.q.trim() !== "") {
    const q = `%${filter.q.trim()}%`;
    where.push("(code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR email LIKE ?)");
    params.push(q, q, q, q);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRow = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM orders ${clause}`,
    params,
  );
  const total = countRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page ?? 1), pages);
  const rows = await db.all<AdminOrderRow>(
    `SELECT code, status, customer_name, customer_phone, city, delivery_date, courier, total_idr, created_at, shipping_status, shipping_actual_idr
\t\t FROM orders ${clause} ORDER BY delivery_date ASC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return { rows: rows.map(toLine), total, page, pages };
}

export interface AdminOrderDetail extends AdminOrderLine {
  email: string | null;
  address: string;
  lat: number;
  lng: number;
  note: string | null;
  internalNote: string | null;
  subtotalIdr: number;
  expiresAt: string;
  paidAt: string | null;
  courierBookedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  doneAt: string | null;
  cancelledReason: string | null;
  manualPaidReason: string | null;
  refundNotedAt: string | null;
  refundNote: string | null;
  items: { name: string; priceIdr: number; qty: number }[];
  history: AuditEntry[];
}

export async function adminOrderDetail(code: string): Promise<AdminOrderDetail | null> {
  const db = await getDb();
  const row = await db.get<
    AdminOrderRow & {
      id: number;
      email: string | null;
      address: string;
      lat: number;
      lng: number;
      note: string | null;
      internal_note: string | null;
      subtotal_idr: number;
      expires_at: string;
      paid_at: string | null;
      courier_booked_at: string | null;
      packed_at: string | null;
      shipped_at: string | null;
      done_at: string | null;
      cancelled_reason: string | null;
      manual_paid_reason: string | null;
      refund_noted_at: string | null;
      refund_note: string | null;
    }
  >("SELECT * FROM orders WHERE code = ?", [code]);
  if (!row) return null;
  const items = (
    await db.all<{ name_snapshot: string; price_snapshot: number; qty: number }>(
      "SELECT name_snapshot, price_snapshot, qty FROM order_items WHERE order_id = ?",
      [row.id],
    )
  ).map((item) => ({ name: item.name_snapshot, priceIdr: item.price_snapshot, qty: item.qty }));
  const historyRows = await db.all<{
    id: string;
    actor: string;
    entity: string;
    entity_id: string;
    action: string;
    before_json: string | null;
    after_json: string | null;
    created_at: string;
  }>("SELECT * FROM audit_log WHERE entity = 'order' AND entity_id = ? ORDER BY created_at DESC", [
    code,
  ]);
  return {
    ...toLine(row),
    email: row.email,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    internalNote: row.internal_note,
    subtotalIdr: row.subtotal_idr,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    courierBookedAt: row.courier_booked_at,
    packedAt: row.packed_at,
    shippedAt: row.shipped_at,
    doneAt: row.done_at,
    cancelledReason: row.cancelled_reason,
    manualPaidReason: row.manual_paid_reason,
    refundNotedAt: row.refund_noted_at,
    refundNote: row.refund_note,
    items,
    history: historyRows.map((h) => ({
      id: h.id,
      actor: h.actor,
      entity: h.entity,
      entityId: h.entity_id,
      action: h.action,
      before: parseJson(h.before_json),
      after: parseJson(h.after_json),
      createdAt: h.created_at,
    })),
  };
}

// ---------- Beranda Hari ini (AD-01..AD-04) ----------

export interface TodaySummary {
  needAction: AdminOrderLine[];
  weekend: {
    date: string;
    weekdayName: string;
    orderCount: number;
    packageCount: number;
    perCourier: Record<string, number>;
  }[];
  lowStock: {
    variantId: number;
    productName: string;
    label: string;
    stock: number;
    locked: number;
  }[];
  counts: { pending_payment: number; paid: number; packed: number; shipped: number };
  threshold: number;
  storeOpen: boolean;
  openCheckoutDate: string;
}

export async function adminToday(now = new Date()): Promise<TodaySummary> {
  const db = await getDb();
  const settings = await getSettings();
  const threshold = Number(settings.low_stock_threshold ?? "10");

  const needRows = await db.all<AdminOrderRow>(
    `SELECT code, status, customer_name, customer_phone, city, delivery_date, courier, total_idr, created_at, shipping_status, shipping_actual_idr
\t\t FROM orders WHERE status IN ('paid', 'packed', 'shipped') ORDER BY delivery_date ASC, created_at ASC LIMIT 10`,
  );

  // Rekap akhir pekan terdekat (Sabtu & Minggu) untuk pesanan yang masih
  // dikerjakan: dibayar + dikemas (AD-02).
  const dayMs = 86_400_000;
  const weekendDates: { date: string; weekdayName: "Sabtu" | "Minggu" }[] = [];
  {
    const probe = new Date(now.getTime() + 7 * 3_600_000); // zona Asia/Jakarta
    for (let i = 0; i < 14 && weekendDates.length < 2; i++) {
      const d = new Date(probe.getTime() + i * dayMs);
      const day = d.getUTCDay();
      if (day === 6 || day === 0) {
        weekendDates.push({
          date: isoDate(d),
          weekdayName: day === 6 ? "Sabtu" : "Minggu",
        });
      }
    }
  }

  // Rekap akhir pekan dalam satu query gabungan (bukan satu query per pesanan):
  // jumlah kemasan langsung dihitung dari order_items.
  const weekendRows = weekendDates.length
    ? await db.all<{ delivery_date: string; courier: string; packages: number }>(
        `SELECT o.delivery_date, o.courier, COALESCE(SUM(oi.qty), 0) AS packages
\t\t FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
\t\t WHERE o.delivery_date IN (${weekendDates.map(() => "?").join(", ")})
\t\t AND o.status IN ('paid', 'packed')
\t\t GROUP BY o.id`,
        weekendDates.map((entry) => entry.date),
      )
    : [];
  const weekend = weekendDates.map((entry) => {
    const rows = weekendRows.filter((row) => row.delivery_date === entry.date);
    const perCourier: Record<string, number> = {};
    let packageCount = 0;
    for (const row of rows) {
      perCourier[row.courier] = (perCourier[row.courier] ?? 0) + 1;
      packageCount += row.packages;
    }
    return {
      date: entry.date,
      weekdayName: entry.weekdayName,
      orderCount: rows.length,
      packageCount,
      perCourier,
    };
  });

  // Ringkasan pesanan aktif per status (baris ringkasan di beranda).
  const countRows = await db.all<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM orders
\t\t WHERE status IN ('pending_payment', 'paid', 'packed', 'shipped')
\t\t GROUP BY status`,
  );
  const counts = { pending_payment: 0, paid: 0, packed: 0, shipped: 0 };
  for (const row of countRows) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] = row.n;
    }
  }

  const lowStock = (
    await db.all<{
      variant_id: number;
      product_name: string;
      label: string;
      stock: number;
      locked: number;
    }>(
      `SELECT v.id AS variant_id, p.name AS product_name, v.label, v.stock,
\t\t\t\t(SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
\t\t\t\t WHERE oi.variant_id = v.id AND o.status = 'pending_payment') AS locked
\t\t\t FROM variants v JOIN products p ON p.id = v.product_id
\t\t\t WHERE v.is_active = 1 AND p.is_active = 1
\t\t\t ORDER BY v.stock ASC`,
    )
  )
    .filter((row) => row.stock < threshold)
    .map((row) => ({
      variantId: row.variant_id,
      productName: row.product_name,
      label: row.label,
      stock: row.stock,
      locked: row.locked,
    }));

  return {
    needAction: needRows.map(toLine),
    weekend,
    counts,
    lowStock,
    threshold,
    storeOpen: settings.store_open !== "0",
    openCheckoutDate: isoDate(now),
  };
}

// ---------- Pengiriman (AD-15, AD-16) ----------

export interface PackingList {
  date: string;
  orderCount: number;
  packageCount: number;
  lines: { variantId: number; name: string; label: string; qty: number }[];
  orders: {
    code: string;
    customerName: string;
    status: OrderStatus;
    packageCount: number;
    items: { name: string; qty: number }[];
  }[];
}

export async function adminPackingList(date: string): Promise<PackingList> {
  const db = await getDb();
  const orders = await db.all<{
    code: string;
    customer_name: string;
    status: OrderStatus;
    id: number;
  }>(
    `SELECT id, code, customer_name, status FROM orders WHERE delivery_date = ? AND status IN ('paid', 'packed') ORDER BY created_at ASC`,
    [date],
  );
  const lines = new Map<number, { variantId: number; name: string; label: string; qty: number }>();
  let packageCount = 0;
  const orderSummaries: PackingList["orders"] = [];
  for (const order of orders) {
    const items = await db.all<{ variant_id: number; name_snapshot: string; qty: number }>(
      "SELECT variant_id, name_snapshot, qty FROM order_items WHERE order_id = ?",
      [order.id],
    );
    let orderPackages = 0;
    for (const item of items) {
      orderPackages += item.qty;
      packageCount += item.qty;
      const existing = lines.get(item.variant_id);
      const label = item.name_snapshot;
      if (existing) {
        existing.qty += item.qty;
      } else {
        const variant = await db.get<{ label: string; product_name: string }>(
          "SELECT v.label, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?",
          [item.variant_id],
        );
        lines.set(item.variant_id, {
          variantId: item.variant_id,
          name: variant?.product_name ?? label,
          label: variant?.label ?? "",
          qty: item.qty,
        });
      }
    }
    orderSummaries.push({
      code: order.code,
      customerName: order.customer_name,
      status: order.status,
      packageCount: orderPackages,
      items: items.map((item) => ({ name: item.name_snapshot, qty: item.qty })),
    });
  }
  return {
    date,
    orderCount: orders.length,
    packageCount,
    lines: [...lines.values()].sort((a, b) => a.name.localeCompare(b.name)),
    orders: orderSummaries,
  };
}

export interface DeliveryGroup {
  courier: string;
  cities: {
    city: string;
    orders: {
      code: string;
      customerName: string;
      customerPhone: string;
      address: string;
      note: string | null;
      status: OrderStatus;
      shippingStatus: string;
    }[];
  }[];
}

export async function adminDeliveryList(date: string): Promise<DeliveryGroup[]> {
  const db = await getDb();
  const rows = await db.all<{
    code: string;
    customer_name: string;
    customer_phone: string;
    address: string;
    city: string;
    note: string | null;
    courier: string;
    status: OrderStatus;
    shipping_status: string;
  }>(
    `SELECT code, customer_name, customer_phone, address, city, note, courier, status, shipping_status
\t\t FROM orders WHERE delivery_date = ? AND status IN ('paid', 'packed', 'shipped') ORDER BY courier, city, created_at`,
    [date],
  );
  const byCourier = new Map<string, DeliveryGroup>();
  for (const row of rows) {
    let group = byCourier.get(row.courier);
    if (!group) {
      group = { courier: row.courier, cities: [] };
      byCourier.set(row.courier, group);
    }
    let city = group.cities.find((c) => c.city === row.city);
    if (!city) {
      city = { city: row.city, orders: [] };
      group.cities.push(city);
    }
    city.orders.push({
      code: row.code,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      address: row.address,
      note: row.note,
      status: row.status,
      shippingStatus: row.shipping_status,
    });
  }
  return [...byCourier.values()];
}

// ---------- Laporan (AD-21) + ekspor CSV ----------

export interface ReportData {
  from: string;
  to: string;
  statusCounts: { status: OrderStatus; n: number }[];
  orderCount: number;
  omzetIdr: number;
  perVariant: { name: string; qty: number; revenueIdr: number }[];
}

export async function adminReport(from: string, to: string): Promise<ReportData> {
  const db = await getDb();
  const statusCounts = await db.all<{ status: OrderStatus; n: number }>(
    "SELECT status, COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at < ? GROUP BY status",
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  const totals = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at < ?",
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  // BA-06: ongkir tidak masuk total — omzet dari total pesanan saja.
  const omzet = await db.get<{ n: number }>(
    "SELECT COALESCE(SUM(total_idr), 0) AS n FROM orders WHERE status IN ('paid', 'packed', 'shipped', 'done') AND created_at >= ? AND created_at < ?",
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  const perVariant = await db.all<{ name: string; qty: number; revenue: number }>(
    `SELECT oi.name_snapshot AS name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price_snapshot) AS revenue
\t\t FROM order_items oi JOIN orders o ON o.id = oi.order_id
\t\t WHERE o.created_at >= ? AND o.created_at < ?
\t\t GROUP BY oi.name_snapshot ORDER BY qty DESC`,
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  return {
    from,
    to,
    statusCounts,
    orderCount: totals?.n ?? 0,
    omzetIdr: omzet?.n ?? 0,
    perVariant: perVariant.map((row) => ({
      name: row.name,
      qty: row.qty,
      revenueIdr: row.revenue,
    })),
  };
}

export async function adminOrdersCsvRows(
  from: string,
  to: string,
): Promise<(string | number | null)[][]> {
  const db = await getDb();
  const rows = await db.all<{
    code: string;
    status: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    city: string;
    delivery_date: string;
    courier: string;
    shipping_status: string;
    shipping_actual_idr: number | null;
    total_idr: number;
    paid_at: string | null;
  }>(
    `SELECT code, status, created_at, customer_name, customer_phone, city, delivery_date, courier,
\t\t\t shipping_status, shipping_actual_idr, total_idr, paid_at
\t\t FROM orders WHERE created_at >= ? AND created_at < ? ORDER BY created_at`,
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  return rows.map((row) => [
    row.code,
    row.status,
    row.created_at,
    row.customer_name,
    row.customer_phone,
    row.city,
    row.delivery_date,
    row.courier,
    row.shipping_status,
    row.shipping_actual_idr,
    row.total_idr,
    row.paid_at,
  ]);
}

export async function adminLogExported(from: string, to: string, actor: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await writeAudit(tx, {
      actor,
      entity: "export",
      entityId: `${from}..${to}`,
      action: "orders_exported",
      before: null,
      after: { from, to },
      at: new Date().toISOString(),
    });
  });
}

// ---------- Log audit (AD-22) ----------

export async function adminLogList(filter: {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
}): Promise<AuditEntry[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.entity) {
    where.push("entity = ?");
    params.push(filter.entity);
  }
  if (filter.action) {
    where.push("action = ?");
    params.push(filter.action);
  }
  if (filter.from) {
    where.push("created_at >= ?");
    params.push(`${filter.from}T00:00:00.000Z`);
  }
  if (filter.to) {
    where.push("created_at <= ?");
    params.push(`${filter.to}T23:59:59.999Z`);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.all<{
    id: string;
    actor: string;
    entity: string;
    entity_id: string;
    action: string;
    before_json: string | null;
    after_json: string | null;
    created_at: string;
  }>(`SELECT * FROM audit_log ${clause} ORDER BY created_at DESC LIMIT 200`, params);
  return rows.map((h) => ({
    id: h.id,
    actor: h.actor,
    entity: h.entity,
    entityId: h.entity_id,
    action: h.action,
    before: parseJson(h.before_json),
    after: parseJson(h.after_json),
    createdAt: h.created_at,
  }));
}

// ---------- Log transaksi pembayaran ----------

export interface TransactionEntry {
  invoiceNumber: string;
  paymentStatus: string;
  checkoutUrl: string | null;
  createdAt: string;
  orderCode: string;
  customerName: string;
  totalIdr: number;
  orderStatus: string;
  paidAt: string | null;
}

// Riwayat pembayaran (tabel payments) digabung pesanan — hanya-baca.
export async function adminTransactionList(filter: {
  paymentStatus?: string;
}): Promise<TransactionEntry[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.paymentStatus) {
    where.push("p.status = ?");
    params.push(filter.paymentStatus);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.all<{
    invoice_number: string;
    payment_status: string;
    checkout_url: string | null;
    created_at: string;
    order_code: string;
    customer_name: string;
    total_idr: number;
    order_status: string;
    paid_at: string | null;
  }>(
    `SELECT p.invoice_number, p.status AS payment_status, p.checkout_url, p.created_at, o.code AS order_code, o.customer_name, o.total_idr, o.status AS order_status, o.paid_at FROM payments p JOIN orders o ON o.id = p.order_id ${clause} ORDER BY p.created_at DESC LIMIT 200`,
    params,
  );
  return rows.map((r) => ({
    invoiceNumber: r.invoice_number,
    paymentStatus: r.payment_status,
    checkoutUrl: r.checkout_url,
    createdAt: r.created_at,
    orderCode: r.order_code,
    customerName: r.customer_name,
    totalIdr: r.total_idr,
    orderStatus: r.order_status,
    paidAt: r.paid_at,
  }));
}
