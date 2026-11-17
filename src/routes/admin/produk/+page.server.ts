// Produk dan stok (PRD Portal Admin — AD-18, AD-19): harga, aktif/nonaktif,
// penyesuaian stok bercatatan, dan riwayat pergerakan stok.

import { fail } from "@sveltejs/kit";
import { adminAdjustStock, adminUpdateProduct, adminUpdateVariant } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { getDb, getSettings } from "#lib/server/db";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  const db = await getDb();
  const settings = await getSettings();
  const variants = await db.all<{
    id: number;
    product_id: number;
    product_name: string;
    product_active: number;
    label: string;
    price_idr: number;
    stock: number;
    is_active: number;
    locked: number;
  }>(
    `SELECT v.id, v.product_id, p.name AS product_name, p.is_active AS product_active,
\t\t\t v.label, v.price_idr, v.stock, v.is_active,
\t\t\t (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
\t\t\t  WHERE oi.variant_id = v.id AND o.status = 'pending_payment') AS locked
\t\t FROM variants v JOIN products p ON p.id = v.product_id
\t\t ORDER BY p.sort_order, v.weight_grams`,
  );
  const movements = await db.all<{
    id: string;
    variant_id: number;
    delta: number;
    reason: string;
    actor: string;
    created_at: string;
  }>(
    "SELECT id, variant_id, delta, reason, actor, created_at FROM stock_movements ORDER BY created_at DESC LIMIT 20",
  );
  return {
    variants,
    movements,
    threshold: Number(settings.low_stock_threshold ?? "10"),
    isDev: import.meta.env.DEV,
  };
};

export const actions: Actions = {
  varian: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const variantId = Number(form.get("variant_id"));
    const priceRaw = String(form.get("price") ?? "").replace(/[^\d]/g, "");
    const active = String(form.get("active") ?? "");
    const result = await adminUpdateVariant(
      variantId,
      {
        ...(priceRaw === "" ? {} : { priceIdr: Number(priceRaw) }),
        ...(active === "" ? {} : { isActive: active === "1" }),
      },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  stok: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminAdjustStock(
      Number(form.get("variant_id")),
      Number(form.get("delta")),
      String(form.get("reason") ?? ""),
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  produk: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminUpdateProduct(
      Number(form.get("product_id")),
      { isActive: String(form.get("active")) === "1" },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
};
