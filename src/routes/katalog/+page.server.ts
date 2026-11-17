import { error } from "@sveltejs/kit";
import {
  bookedCounts,
  getSettings,
  listProducts,
  type ProductView,
  productSoldCounts,
} from "#lib/server/db";
import { type DeliveryOption, upcomingDeliveryDates } from "#lib/server/schedule";

export interface KatalogProduct extends ProductView {
  sold: number;
  bestSeller: boolean;
}

export interface KatalogData {
  products: KatalogProduct[];
  deliveryDates: DeliveryOption[];
}

export const load = async (): Promise<KatalogData> => {
  try {
    const settings = await getSettings();
    const deliveryDates = upcomingDeliveryDates(new Date(), {
      cutoffWeekday: Number(settings.order_cutoff_weekday),
      cutoffTime: settings.order_cutoff_time ?? "23:59",
      dailyCapacity: Number(settings.daily_capacity),
      booked: await bookedCounts(),
    });
    const products = await listProducts();
    const sold = await productSoldCounts();
    // Label "Best seller": satu produk dengan jumlah terjual tertinggi (minimal 1);
    // bila seri, produk yang tampil lebih dulu yang mendapat label.
    const maxSold = Math.max(0, ...products.map((product) => sold.get(product.id) ?? 0));
    const bestSellerId =
      maxSold > 0
        ? (products.find((product) => (sold.get(product.id) ?? 0) === maxSold)?.id ?? null)
        : null;
    const items: KatalogProduct[] = products.map((product) => {
      const productSold = sold.get(product.id) ?? 0;
      return {
        ...product,
        sold: productSold,
        bestSeller: product.id === bestSellerId,
      };
    });
    return { products: items, deliveryDates };
  } catch {
    error(500, "Katalog belum bisa dimuat. Coba lagi sebentar lagi.");
  }
};
