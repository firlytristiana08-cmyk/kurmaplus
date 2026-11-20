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
  // Galeri foto: baris product_photos — semuanya diatur di admin.
  const photos = product.photos.map((entry) => entry.src);
  return { product, photos };
};
