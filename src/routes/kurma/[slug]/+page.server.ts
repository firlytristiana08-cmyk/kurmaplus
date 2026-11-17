import { existsSync } from "node:fs";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { getProductBySlug, type ProductView } from "#lib/server/db";

export interface ProductData {
  product: ProductView;
  photos: string[];
}

export const load = async ({ params }): Promise<ProductData> => {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    error(404, "Produk tidak ditemukan.");
  }
  // Galeri foto: foto utama + foto tambahan (-2, -3) bila berkasnya ada.
  const main = product.photo;
  const photos = main
    ? [main, main.replace(/\.webp$/, "-2.webp"), main.replace(/\.webp$/, "-3.webp")].filter(
        (file) => existsSync(join(process.cwd(), "static/images", file)),
      )
    : [];
  return { product, photos };
};
