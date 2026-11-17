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
    // Label "Best seller": tanda yang diatur admin (products.is_best_seller).
    const items: KatalogProduct[] = products.map((product) => ({
      ...product,
      sold: sold.get(product.id) ?? 0,
      bestSeller: product.isBestSeller,
    }));
    return { products: items, deliveryDates };
  } catch {
    error(500, "Katalog belum bisa dimuat. Coba lagi sebentar lagi.");
  }
};
