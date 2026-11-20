// Ubah produk (tugas 116): detail, foto galeri, varian, stok, dan hapus
// produk — masing-masing aksi terpisah di halaman ini.

import { fail, redirect } from "@sveltejs/kit";
import {
  adminAddProductPhotos,
  adminAdjustStock,
  adminCreateVariant,
  adminDeleteProduct,
  adminDeleteProductPhoto,
  adminDeleteVariant,
  adminUpdateProduct,
  adminUpdateVariant,
} from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { getDb, getSettings } from "#lib/server/db";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, params }) => {
  await requireAdmin(cookies);
  const db = await getDb();
  const settings = await getSettings();
  const productId = Number(params.id);
  const product = await db.get<{
    id: number;
    slug: string;
    name: string;
    description: string;
    sort_order: number;
    is_active: number;
    is_best_seller: number;
  }>(
    "SELECT id, slug, name, description, sort_order, is_active, is_best_seller FROM products WHERE id = ?",
    [productId],
  );
  if (!product) {
    throw redirect(303, "/admin/produk");
  }
  const photos = await db.all<{ id: number; sort_order: number }>(
    "SELECT id, sort_order FROM product_photos WHERE product_id = ? ORDER BY sort_order, id",
    [productId],
  );
  const variants = await db.all<{
    id: number;
    label: string;
    weight_grams: number;
    price_idr: number;
    stock: number;
    is_active: number;
    locked: number;
  }>(
    `SELECT v.id, v.label, v.weight_grams, v.price_idr, v.stock, v.is_active,
\t\t\t (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
\t\t\t  WHERE oi.variant_id = v.id AND o.status = 'pending_payment') AS locked
\t\t FROM variants v WHERE v.product_id = ? ORDER BY v.weight_grams`,
    [productId],
  );
  return {
    product,
    photos: photos.map((photo) => ({ id: photo.id, src: `/api/foto/${photo.id}` })),
    variants,
    threshold: Number(settings.low_stock_threshold ?? "10"),
    isDev: import.meta.env.DEV,
  };
};

export const actions: Actions = {
  detail: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const sortRaw = String(form.get("sort_order") ?? "").replace(/[^\d]/g, "");
    const result = await adminUpdateProduct(
      Number(params.id),
      {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        ...(sortRaw === "" ? {} : { sortOrder: Number(sortRaw) }),
        isBestSeller: String(form.get("best")) === "1",
      },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  produk: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminUpdateProduct(
      Number(params.id),
      { isActive: String(form.get("active")) === "1" },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  foto_tambah: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const photos = form
      .getAll("photos")
      .map((v) => String(v ?? "").trim())
      .filter((v) => v !== "");
    const result = await adminAddProductPhotos(Number(params.id), photos, session.email);
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
  foto_hapus: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminDeleteProductPhoto(Number(form.get("photo_id")), session.email);
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
  stok: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const deltaRaw = String(form.get("delta") ?? "").replace(/[^\d-]/g, "");
    const result = await adminAdjustStock(
      Number(form.get("variant_id")),
      Number(deltaRaw || "0"),
      String(form.get("reason") ?? ""),
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
  tambah: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const weightRaw = String(form.get("weight") ?? "").replace(/[^\d]/g, "");
    const priceRaw = String(form.get("price") ?? "").replace(/[^\d]/g, "");
    const stockRaw = String(form.get("stock") ?? "").replace(/[^\d]/g, "");
    const result = await adminCreateVariant(
      Number(params.id),
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
  hapus_produk: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    await request.formData();
    const result = await adminDeleteProduct(Number(params.id), session.email);
    if (!result.ok) return fail(400, { message: result.error });
    redirect(303, "/admin/produk");
  },
};
