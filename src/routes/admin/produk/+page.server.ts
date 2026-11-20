// Produk — halaman daftar (tugas 116): detail, foto, dan varian diatur di
// halaman /admin/produk/[id]; produk baru lewat /admin/produk/tambah.

import { requireAdmin } from "#lib/server/admin-auth";
import { getDb, getSettings } from "#lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  const db = await getDb();
  const settings = await getSettings();
  const products = await db.all<{
    id: number;
    name: string;
    is_active: number;
    is_best_seller: number;
  }>("SELECT id, name, is_active, is_best_seller FROM products ORDER BY sort_order, id");
  const variants = await db.all<{
    id: number;
    product_id: number;
    label: string;
    weight_grams: number;
    price_idr: number;
    stock: number;
    is_active: number;
  }>(
    "SELECT id, product_id, label, weight_grams, price_idr, stock, is_active FROM variants ORDER BY product_id, weight_grams",
  );
  const photos = await db.all<{ id: number; product_id: number }>(
    "SELECT id, product_id FROM product_photos ORDER BY product_id, sort_order, id",
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
    products,
    variants,
    photos,
    movements,
    threshold: Number(settings.low_stock_threshold ?? "10"),
  };
};
