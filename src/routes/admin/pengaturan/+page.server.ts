// Pengaturan toko (PRD Portal Admin — AD-20, BA-10, BA-11).

import { fail } from "@sveltejs/kit";
import { adminUpdateSettings } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { getSettings } from "#lib/server/db";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  const settings = await getSettings();
  let waTemplates: Record<string, string> = {};
  try {
    waTemplates = JSON.parse(settings.wa_templates ?? "{}") as Record<string, string>;
  } catch {
    waTemplates = {};
  }
  return { settings, waTemplates };
};

export const actions: Actions = {
  simpan: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const closedDates = String(form.get("closed_dates") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d !== "");
    const patch: Record<string, string> = {
      store_open: String(form.get("store_open") ?? "1") === "1" ? "1" : "0",
      closed_dates: JSON.stringify(closedDates),
      shop_whatsapp: String(form.get("shop_whatsapp") ?? "").replace(/[^\d]/g, ""),
      shipping_info_text: String(form.get("shipping_info_text") ?? "").trim(),
      low_stock_threshold: String(form.get("low_stock_threshold") ?? "").trim(),
      order_cutoff_weekday: String(form.get("order_cutoff_weekday") ?? "").trim(),
      order_cutoff_time: String(form.get("order_cutoff_time") ?? "").trim(),
      payment_timeout_minutes: String(form.get("payment_timeout_minutes") ?? "").trim(),
      daily_capacity: String(form.get("daily_capacity") ?? "").trim(),
      wa_templates: JSON.stringify({
        konfirmasi: String(form.get("wa_konfirmasi") ?? "").trim(),
        tagih_ongkir: String(form.get("wa_tagih") ?? "").trim(),
        pindah_tanggal: String(form.get("wa_pindah") ?? "").trim(),
      }),
    };
    const result = await adminUpdateSettings(patch, session.email);
    if (!result.ok) return fail(400, { message: result.error });
    return { saved: true };
  },
};
