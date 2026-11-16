import { type Actions, error, redirect } from "@sveltejs/kit";
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
}

export const load = async ({ params }): Promise<OrderPageData> => {
  const now = new Date();
  expireStaleOrders(now);
  const order = getOrderByCode(params.kode);
  if (!order) {
    error(404, "Pesanan tidak ditemukan.");
  }
  const settings = getSettings();
  const dokuConfig = loadDokuConfig(process.env);

  // FR-14: saat masih menunggu bayar, tanyakan status ke DOKU dulu.
  if (order.status === "pending_payment" && dokuConfig) {
    try {
      const status = await checkStatus(dokuConfig, order.code, now);
      if (status.transactionStatus === "SUCCESS") {
        markPaidByInvoice(order.code, now);
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
  };
};

export const actions: Actions = {
  // Sesi bayar baru — dipakai bila tombol bayar tadi gagal terhubung.
  bayar: async ({ params, url }) => {
    const kode = params.kode;
    if (!kode) {
      error(404, "Pesanan tidak ditemukan.");
    }
    const order = getOrderByCode(kode);
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
    const payment = await createCheckoutPayment(dokuConfig, {
      invoiceNumber: order.code,
      amountIdr: order.totalIdr,
      paymentDueMinutes: Number(getSettings().payment_timeout_minutes),
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        address: order.address,
        city: order.city,
      },
      callbackUrl: `${url.origin}/pesanan/${order.code}`,
      lineItems: order.items.map((item) => ({
        name: item.name,
        quantity: item.qty,
        price: item.priceIdr,
      })),
    });
    saveCheckoutUrl(order.code, payment.paymentUrl);
    redirect(303, payment.paymentUrl);
  },

  // Pratinjau tanpa kunci DOKU: status sukses diset lewat jalur yang sama
  // dengan notifikasi (markPaidByInvoice — idempoten).
  simulasi: ({ params }) => {
    const kode = params.kode;
    if (!kode) {
      error(404, "Pesanan tidak ditemukan.");
    }
    const order = getOrderByCode(kode);
    if (!order) {
      error(404, "Pesanan tidak ditemukan.");
    }
    if (loadDokuConfig(process.env) !== null) {
      error(403, "Simulasi hanya tersedia saat kunci DOKU belum diatur.");
    }
    markPaidByInvoice(order.code, new Date());
    redirect(303, `/pesanan/${order.code}`);
  },
};
