// Detail pesanan + seluruh aksi admin pada satu pesanan (AD-06..AD-14).
// Semua tulis lewat pintu tunggal admin.ts — halaman tidak menyentuh tabel.

import { error, fail } from "@sveltejs/kit";
import type { OrderStatus } from "#lib/order-status";
import {
  adminChangeStatus,
  adminManualPaid,
  adminMoveDelivery,
  adminNoteRefund,
  adminOrderDetail,
  adminSaveNote,
  adminSetShipping,
} from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { expireStaleOrders, getSettings } from "#lib/server/db";
import { checkStatus, loadDokuConfig } from "#lib/server/doku";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, params }) => {
  await requireAdmin(cookies);
  // Sinkronkan status: pesanan yang masa bayarnya habis ikut ditutup sistem.
  await expireStaleOrders(new Date());
  const order = await adminOrderDetail(params.kode);
  if (!order) error(404, "Pesanan tidak ditemukan.");
  const settings = await getSettings();
  let waTemplates: Record<string, string> = {};
  try {
    waTemplates = JSON.parse(settings.wa_templates ?? "{}") as Record<string, string>;
  } catch {
    waTemplates = {};
  }
  return {
    order,
    isDev: import.meta.env.DEV,
    shopWhatsapp: settings.shop_whatsapp ?? settings.whatsapp_owner ?? "",
    waTemplates,
  };
};

export const actions: Actions = {
  status: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const to = String(form.get("to") ?? "") as OrderStatus;
    const reason = String(form.get("reason") ?? "");
    const restoreStock = String(form.get("restore_stock") ?? "1") !== "0";
    const result = await adminChangeStatus(params.kode, to, {
      actor: session.email,
      reason,
      restoreStock,
    });
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  bayar_manual: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminManualPaid(
      params.kode,
      String(form.get("reason") ?? ""),
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  // Ongkir disimpan sebagai: nominal + satu tombol konfirmasi. Nominal yang
  // tersimpan otomatis dipakai templat WhatsApp "Tagih ongkir".
  ongkir: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const rawAmount = String(form.get("nominal") ?? "").replace(/[^\d]/g, "");
    const patch: Parameters<typeof adminSetShipping>[1] = {};
    if (rawAmount !== "") patch.shippingActualIdr = Number(rawAmount);
    if (String(form.get("batalkan") ?? "") === "1") {
      patch.shippingStatus = "pending";
    } else if (String(form.get("konfirmasi") ?? "") === "1") {
      patch.shippingStatus = "paid";
    }
    const result = await adminSetShipping(params.kode, patch, session.email);
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  tanggal: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminMoveDelivery(
      params.kode,
      String(form.get("date") ?? ""),
      String(form.get("note") ?? ""),
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  catatan: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminSaveNote(params.kode, String(form.get("note") ?? ""), session.email);
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  refund: async ({ cookies, request, params }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const result = await adminNoteRefund(
      params.kode,
      String(form.get("note") ?? ""),
      session.email,
    );
    if (!result.ok) return fail(400, { message: result.error });
    return { done: true };
  },
  cek_doku: async ({ params }) => {
    const config = loadDokuConfig(process.env);
    if (config === null) {
      // Pratinjau tanpa kunci DOKU: kembalikan status pembayaran tersimpan.
      const order = await adminOrderDetail(params.kode);
      return {
        doku: {
          transactionStatus: order?.paidAt ? "SUCCESS" : "PENDING",
          orderStatus: order?.paidAt ? "PAID" : "UNPAID",
          preview: true,
        },
      };
    }
    try {
      const result = await checkStatus(config, params.kode);
      return { doku: { ...result, preview: false } };
    } catch (error) {
      return fail(502, {
        message: `Cek DOKU gagal: ${error instanceof Error ? error.message : "galat jaringan"}`,
      });
    }
  },
};
