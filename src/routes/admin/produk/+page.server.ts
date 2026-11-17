// Produk, detail, dan stok (PRD Portal Admin — AD-18, AD-19): seluruh detail
// produk dapat diatur di dashboard (tugas 90) — nama, deskripsi, foto galeri,
// urutan, tanda Best seller, serta kelola varian (tambah/ubah/hapus).

import { fail } from "@sveltejs/kit";
import {
  adminAdjustStock,
  adminCreateVariant,
  adminDeleteVariant,
  adminUpdateProduct,
  adminUpdateVariant,
} from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { getDb, getSettings } from "#lib/server/db";
import type { Actions, PageServerLoad } from "./$types";

function emptyToNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  const db = await getDb();
  const settings = await getSettings();
  const variants = await db.all<{
    id: number;
    product_id: number;
    product_name: string;
    product_description: string;
    product_photo: string | null;
    product_photo_2: string | null;
    product_photo_3: string | null;
    product_sort: number;
    product_active: number;
    product_best: number;
    label: string;
    weight_grams: number;
    price_idr: number;
    stock: number;
    is_active: number;
    locked: number;
  }>(
    `SELECT v.id, v.product_id, p.name AS product_name, p.description AS product_description,
\t\t\t p.photo AS product_photo, p.photo_2 AS product_photo_2, p.photo_3 AS product_photo_3,
\t\t\t p.sort_order AS product_sort, p.is_active AS product_active, p.is_best_seller AS product_best,
\t\t\t v.label, v.weight_grams, v.price_idr, v.stock, v.is_active,
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
  detail: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const sortRaw = String(form.get("sort_order") ?? "").replace(/[^\d]/g, "");
    const result = await adminUpdateProduct(
      Number(form.get("product_id")),
      {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        photo: emptyToNull(String(form.get("photo") ?? "")),
        photo2: emptyToNull(String(form.get("photo_2") ?? "")),
        photo3: emptyToNull(String(form.get("photo_3") ?? "")),
        ...(sortRaw === "" ? {} : { sortOrder: Number(sortRaw) }),
        isBestSeller: String(form.get("best")) === "1",
      },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  varian: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const variantId = Number(form.get("variant_id"));
    const priceRaw = String(form.get("price") ?? "").replace(/[^\d]/g, "");
    const weightRaw = String(form.get("weight") ?? "").replace(/[^\d]/g, "");
    const active = String(form.get("active") ?? "");
    const result = await adminUpdateVariant(
      variantId,
      {
        label: String(form.get("label") ?? ""),
        ...(weightRaw === "" ? {} : { weightGrams: Number(weightRaw) }),
        ...(priceRaw === "" ? {} : { priceIdr: Number(priceRaw) }),
        ...(active === "" ? {} : { isActive: active === "1" }),
      },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  tambah: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const weightRaw = String(form.get("weight") ?? "").replace(/[^\d]/g, "");
    const priceRaw = String(form.get("price") ?? "").replace(/[^\d]/g, "");
    const stockRaw = String(form.get("stock") ?? "").replace(/[^\d]/g, "");
    const result = await adminCreateVariant(
      Number(form.get("product_id")),
      {
        label: String(form.get("label") ?? ""),
        weightGrams: Number(weightRaw || "0"),
        priceIdr: Number(priceRaw || "0"),
        stock: Number(stockRaw || "0"),
      },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  hapus: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminDeleteVariant(Number(form.get("variant_id")), session.email);
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  stok: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const deltaRaw = String(form.get("delta") ?? "").replace(/[^\-?\d]/g, "");
    const result = await adminAdjustStock(
      Number(form.get("variant_id")),
      Number(deltaRaw || "0"),
      String(form.get("reason") ?? ""),
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
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
    return { saved: true };
  },
};
