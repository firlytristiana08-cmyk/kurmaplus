import { error } from "@sveltejs/kit";
import { bookedCounts, getSettings, listProducts, type ProductView } from "#lib/server/db";
import { type DeliveryOption, upcomingDeliveryDates } from "#lib/server/schedule";

export interface KatalogData {
  products: ProductView[];
  deliveryDates: DeliveryOption[];
}

export const load = (): KatalogData => {
  try {
    const settings = getSettings();
    const deliveryDates = upcomingDeliveryDates(new Date(), {
      cutoffWeekday: Number(settings.order_cutoff_weekday),
      cutoffTime: settings.order_cutoff_time ?? "23:59",
      dailyCapacity: Number(settings.daily_capacity),
      booked: bookedCounts(),
    });
    return { products: listProducts(), deliveryDates };
  } catch {
    error(500, "Katalog belum bisa dimuat. Coba lagi sebentar lagi.");
  }
};
