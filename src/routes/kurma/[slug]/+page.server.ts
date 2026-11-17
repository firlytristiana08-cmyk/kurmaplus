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
  // Galeri foto: kolom photo, photo_2, photo_3 — semuanya diatur di admin.
  const photos = [product.photo, product.photo2, product.photo3].filter((file): file is string =>
    Boolean(file),
  );
  return { product, photos };
};
