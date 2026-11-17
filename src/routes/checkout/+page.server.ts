import { type Actions, fail, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import {
  bookedCounts,
  createOrder,
  expireStaleOrders,
  getSettings,
  listProducts,
  newCode,
  type ProductView,
  saveCheckoutUrl,
} from "#lib/server/db";
import { createCheckoutPayment, loadDokuConfig } from "#lib/server/doku";
import {
  boundsFromSettings,
  isInServiceArea,
  isServiceCity,
  JABODETABEK_CITIES,
} from "#lib/server/geo";
import {
  type DeliveryOption,
  isDeliverableDate,
  upcomingDeliveryDates,
} from "#lib/server/schedule";
import { checkoutSchema, normalizePhone } from "#lib/server/validation";

export interface CheckoutData {
  products: ProductView[];
  deliveryDates: DeliveryOption[];
  cities: readonly string[];
  previewPayment: boolean;
  storeOpen: boolean;
  shippingInfoText: string;
}

function closedDatesOf(settings: Record<string, string>): string[] {
  try {
    const parsed = JSON.parse(settings.closed_dates ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export const load = async (): Promise<CheckoutData> => {
  const settings = await getSettings();
  const closedDates = closedDatesOf(settings);
  const deliveryDates = upcomingDeliveryDates(new Date(), {
    cutoffWeekday: Number(settings.order_cutoff_weekday),
    cutoffTime: settings.order_cutoff_time ?? "23:59",
    dailyCapacity: Number(settings.daily_capacity),
    booked: await bookedCounts(),
    // BA-10: tanggal libur menghilangkan tanggal itu dari pilihan pembeli.
  }).filter((option) => !closedDates.includes(option.date));
  return {
    products: await listProducts(),
    deliveryDates,
    cities: JABODETABEK_CITIES,
    previewPayment: loadDokuConfig(process.env) === null,
    storeOpen: settings.store_open !== "0",
    shippingInfoText: settings.shipping_info_text ?? "",
  };
};

// Pembatasan per IP (FR-10): sederhana per proses; di Cloudflare diganti
// pembatasan berbasis Workers setelah deployment.
const recentOrdersByIp = new Map<string, number[]>();
const ORDER_LIMIT = 5;
const ORDER_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string, now: Date): boolean {
  const recent = (recentOrdersByIp.get(ip) ?? []).filter(
    (at) => now.getTime() - at < ORDER_WINDOW_MS,
  );
  recentOrdersByIp.set(ip, recent);
  return recent.length >= ORDER_LIMIT;
}

export const actions: Actions = {
  default: async ({ request, url }) => {
    const now = new Date();
    await expireStaleOrders(now);

    const form = await request.formData();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
    if (isRateLimited(ip, now)) {
      return fail(429, {
        message: "Terlalu banyak pesanan dari jaringan ini. Coba satu jam lagi.",
      });
    }

    let items: unknown;
    try {
      items = JSON.parse(String(form.get("items") ?? "[]"));
    } catch {
      return fail(400, { message: "Keranjang tidak sah. Muat ulang halaman ini." });
    }

    const parsed = v.safeParse(checkoutSchema, {
      customerName: form.get("customerName"),
      customerPhone: form.get("customerPhone"),
      address: form.get("address"),
      city: form.get("city"),
      note: form.get("note") ?? "",
      courier: form.get("courier"),
      deliveryDate: form.get("deliveryDate"),
      lat: Number(form.get("lat")),
      lng: Number(form.get("lng")),
      items,
    });
    if (!parsed.success) {
      const firstIssue = parsed.issues[0];
      return fail(400, {
        message: firstIssue ? String(firstIssue.message) : "Data checkout belum lengkap.",
      });
    }

    const phone = normalizePhone(parsed.output.customerPhone);
    if (!phone) {
      return fail(400, {
        message: "Nomor WhatsApp tidak sah. Gunakan format 08… atau +62…",
      });
    }
    if (!isServiceCity(parsed.output.city)) {
      return fail(400, { message: "Kota atau kabupaten di luar area layanan." });
    }

    const settings = await getSettings();
    // BA-10: toko tutup menonaktifkan checkout dengan pesan; pesanan lama tetap.
    if (settings.store_open === "0") {
      return fail(403, {
        message: "Maaf, toko sedang tutup sementara sehingga pesanan baru belum bisa dibuat.",
      });
    }
    if (closedDatesOf(settings).includes(parsed.output.deliveryDate)) {
      return fail(400, { message: "Tanggal kirim tersebut sedang libur. Pilih tanggal lain." });
    }
    const bounds = boundsFromSettings(settings);
    if (!isInServiceArea(parsed.output.lat, parsed.output.lng, bounds)) {
      return fail(400, {
        message: "Titik peta di luar area layanan Jabodetabek. Geser pin ke lokasi tujuan.",
      });
    }

    const deliveryDates = upcomingDeliveryDates(now, {
      cutoffWeekday: Number(settings.order_cutoff_weekday),
      cutoffTime: settings.order_cutoff_time ?? "23:59",
      dailyCapacity: Number(settings.daily_capacity),
      booked: await bookedCounts(),
    });
    if (!isDeliverableDate(parsed.output.deliveryDate, deliveryDates)) {
      return fail(400, {
        message: "Tanggal kirim tidak tersedia. Pilih Sabtu atau Minggu yang masih kosong.",
      });
    }

    // Server adalah sumber kebenaran harga dan stok (FR-03, FR-09).
    const variants = new Map(
      (await listProducts()).flatMap((product) =>
        product.variants.map((variant) => [variant.id, { ...variant, productName: product.name }]),
      ),
    );
    for (const item of parsed.output.items) {
      const variant = variants.get(item.variantId);
      if (!variant) {
        return fail(400, { message: "Ada barang yang sudah tidak dijual. Periksa keranjang." });
      }
      if (variant.stock < item.qty) {
        return fail(400, {
          message: `Stok ${variant.productName} ${variant.label} tinggal ${variant.stock}. Kurangi jumlahnya.`,
        });
      }
    }

    const code = newCode();
    const paymentTimeoutMinutes = Number(settings.payment_timeout_minutes);
    const created = await createOrder({
      code,
      customerName: parsed.output.customerName,
      customerPhone: phone,
      address: parsed.output.address,
      city: parsed.output.city,
      lat: parsed.output.lat,
      lng: parsed.output.lng,
      courier: parsed.output.courier,
      deliveryDate: parsed.output.deliveryDate,
      note: parsed.output.note || null,
      items: parsed.output.items,
      now,
      paymentTimeoutMinutes,
    });
    if (!created.ok) {
      return fail(400, {
        message: "Stok berubah saat checkout. Periksa kembali keranjang Anda.",
      });
    }

    const dokuConfig = loadDokuConfig(process.env);
    if (dokuConfig) {
      const lineItems = parsed.output.items.map((item) => {
        const variant = variants.get(item.variantId);
        return {
          name: `${variant?.productName ?? "Barang"} ${variant?.label ?? ""}`.trim(),
          quantity: item.qty,
          price: variant?.priceIdr ?? 0,
        };
      });
      try {
        const payment = await createCheckoutPayment(
          dokuConfig,
          {
            invoiceNumber: code,
            amountIdr: created.totalIdr,
            paymentDueMinutes: paymentTimeoutMinutes,
            customer: {
              name: parsed.output.customerName,
              phone,
              address: parsed.output.address,
              city: parsed.output.city,
            },
            callbackUrl: `${url.origin}/pesanan/${code}`,
            lineItems,
          },
          now,
        );
        await saveCheckoutUrl(code, payment.paymentUrl);
        redirect(303, payment.paymentUrl);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "";
        return fail(502, {
          message: `Halaman bayar DOKU belum bisa dibuka${detail === "" ? "" : ` (${detail})`}. Pesanan Anda tersimpan — coba bayar dari halaman pesanan.`,
          code,
        });
      }
    }

    // Tanpa kunci DOKU (pratinjau): pembayaran disimulasikan dari halaman pesanan.
    redirect(303, `/pesanan/${code}`);
  },
};
