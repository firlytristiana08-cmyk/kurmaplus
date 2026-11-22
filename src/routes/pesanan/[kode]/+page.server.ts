import { type Actions, error, fail, redirect } from "@sveltejs/kit";
import { publicBaseUrl } from "#lib/server/base-url";
import {
  expireStaleOrders,
  getOrderByCode,
  getSettings,
  markPaidByInvoice,
  type OrderDetail,
  saveCheckoutUrl,
} from "#lib/server/db";
import { checkStatus, createCheckoutPayment, loadDokuConfig } from "#lib/server/doku";

export interface OrderPageData {
  order: OrderDetail;
  previewPayment: boolean;
  whatsappOwner: string;
  paymentDueMinutes: number;
  showStatusModal: boolean;
}

export const load = async ({ params, url }): Promise<OrderPageData> => {
  const now = new Date();
  await expireStaleOrders(now);
  const order = await getOrderByCode(params.kode);
  if (!order) {
    error(404, "Pesanan tidak ditemukan.");
  }
  const settings = await getSettings();
  const dokuConfig = loadDokuConfig(process.env);

  // FR-14: saat masih menunggu bayar, tanyakan status ke DOKU dulu.
  if (order.status === "pending_payment" && dokuConfig) {
    try {
      const status = await checkStatus(dokuConfig, order.code, now);
      if (status.transactionStatus === "SUCCESS") {
        await markPaidByInvoice(order.code, now);
        order.status = "paid";
        order.paidAt = now.toISOString();
      }
    } catch {
      // Notifikasi yang terlambat tetap akan tiba; tampilan memakai status tersimpan.
    }
  }

  return {
    order,
    previewPayment: dokuConfig === null,
    whatsappOwner: settings.whatsapp_owner ?? "6281234567890",
    paymentDueMinutes: Number(settings.payment_timeout_minutes),
    // Kembali dari halaman bayar DOKU (?dari=pembayaran): tampilkan modal status.
    showStatusModal: url.searchParams.has("dari") || url.searchParams.has("status"),
  };
};

export const actions: Actions = {
  // Sesi bayar baru — dipakai bila tombol bayar tadi gagal terhubung.
  bayar: async ({ params, url }) => {
    const kode = params.kode;
    if (!kode) {
      error(404, "Pesanan tidak ditemukan.");
    }
    const order = await getOrderByCode(kode);
    if (!order) {
      error(404, "Pesanan tidak ditemukan.");
    }
    if (order.status !== "pending_payment") {
      redirect(303, `/pesanan/${order.code}`);
    }
    const dokuConfig = loadDokuConfig(process.env);
    if (!dokuConfig) {
      redirect(303, `/pesanan/${order.code}`);
    }
    let paymentUrl: string;
    try {
      const payment = await createCheckoutPayment(dokuConfig, {
        invoiceNumber: order.code,
        amountIdr: order.totalIdr,
        paymentDueMinutes: Number((await getSettings()).payment_timeout_minutes),
        customer: {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.address,
          city: order.city,
        },
        callbackUrl: `${publicBaseUrl(url.origin)}/pesanan/${order.code}?dari=pembayaran`,
        notificationUrl: `${publicBaseUrl(url.origin)}/api/webhook/doku`,
        lineItems: order.items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          price: item.priceIdr,
        })),
      });
      await saveCheckoutUrl(order.code, payment.paymentUrl);
      paymentUrl = payment.paymentUrl;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      return fail(502, {
        message: `Halaman bayar DOKU belum bisa dibuka${detail === "" ? "" : ` (${detail})`}. Coba lagi dari halaman ini.`,
      });
    }
    // Penting: redirect() di SvelteKit MELEMPAR exception kontrol alur —
    // wajib di luar try/catch supaya tidak ikut tertangkap dan diubah jadi fail().
    redirect(303, paymentUrl, { external: true });
  },

  // Pratinjau tanpa kunci DOKU: status sukses diset lewat jalur yang sama
  // dengan notifikasi (markPaidByInvoice — idempoten).
  simulasi: async ({ params }) => {
    const kode = params.kode;
    if (!kode) {
      error(404, "Pesanan tidak ditemukan.");
    }
    const order = await getOrderByCode(kode);
    if (!order) {
      error(404, "Pesanan tidak ditemukan.");
    }
    if (loadDokuConfig(process.env) !== null) {
      error(403, "Simulasi hanya tersedia saat kunci DOKU belum diatur.");
    }
    await markPaidByInvoice(order.code, new Date());
    redirect(303, `/pesanan/${order.code}`);
  },
};
