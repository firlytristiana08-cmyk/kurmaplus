import { error } from "@sveltejs/kit";
import { getProductBySlug, type ProductView } from "#lib/server/db";

export interface ProductData {
  product: ProductView;
}

export const load = async ({ params }): Promise<ProductData> => {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    error(404, "Produk tidak ditemukan.");
  }
  return { product };
};
