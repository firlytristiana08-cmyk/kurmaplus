// Tambah produk baru (tugas 116) — satu halaman khusus, hasilnya langsung
// diarahkan ke halaman ubah produk yang baru dibuat.

import { fail, redirect } from "@sveltejs/kit";
import { parsePhotoInput } from "#lib/photos";
import { adminCreateProduct } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  return {};
};

export const actions: Actions = {
  buat: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const labels = form.getAll("v_label").map((v) => String(v ?? ""));
    const weights = form.getAll("v_weight").map((v) => String(v ?? ""));
    const prices = form.getAll("v_price").map((v) => String(v ?? ""));
    const stocks = form.getAll("v_stock").map((v) => String(v ?? ""));
    const variants = labels.map((label, i) => ({
      label,
      weightGrams: Number((weights[i] ?? "").replace(/[^\d]/g, "")),
      priceIdr: Number((prices[i] ?? "").replace(/[^\d]/g, "")),
      stock: Number((stocks[i] ?? "").replace(/[^\d]/g, "") || "0"),
    }));
    const photos = form
      .getAll("photos")
      .map((v) => parsePhotoInput(String(v ?? "")))
      .filter((photo) => photo.lg !== "");
    const result = await adminCreateProduct(
      {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        photos,
        variants,
      },
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    redirect(303, `/admin/produk/${result.productId}`);
  },
};
