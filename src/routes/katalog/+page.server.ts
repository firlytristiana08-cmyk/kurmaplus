import { error } from "@sveltejs/kit";
import { listProducts, type ProductView, productSoldCounts } from "#lib/server/db";

export interface KatalogProduct extends ProductView {
  sold: number;
  bestSeller: boolean;
}

export interface KatalogData {
  products: KatalogProduct[];
}

export const load = async (): Promise<KatalogData> => {
  try {
    // Jadwal kirim TIDAK lagi dimuat di sini: kotak "Pengiriman terdekat" di
    // halaman katalog sudah dihapus, jadi menghitungnya (beserta bookedCounts
    // yang menempuh database) hanya membebani setiap kunjungan tanpa dipakai.
    const products = await listProducts();
    const sold = await productSoldCounts();
    // Label "Best seller": tanda yang diatur admin (products.is_best_seller).
    const items: KatalogProduct[] = products.map((product) => ({
      ...product,
      sold: sold.get(product.id) ?? 0,
      bestSeller: product.isBestSeller,
    }));
    return { products: items };
  } catch {
    error(500, "Katalog belum bisa dimuat. Coba lagi sebentar lagi.");
  }
};
