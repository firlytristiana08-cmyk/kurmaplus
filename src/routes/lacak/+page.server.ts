import { type Actions, fail, redirect } from "@sveltejs/kit";
import { findOrderByCodeAndPhoneTail } from "#lib/server/db";

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const code = String(form.get("code") ?? "")
      .trim()
      .toUpperCase();
    const phoneTail = String(form.get("phoneTail") ?? "").trim();

    if (!/^[A-Z2-9]{8}$/.test(code) || !/^\d{4}$/.test(phoneTail)) {
      return fail(400, {
        message: "Isi kode pesanan 8 karakter dan 4 digit terakhir nomor WhatsApp Anda.",
      });
    }

    const order = await findOrderByCodeAndPhoneTail(code, phoneTail);
    if (!order) {
      return fail(404, {
        message: "Kombinasi kode dan nomor WhatsApp tidak cocok dengan pesanan mana pun.",
      });
    }
    redirect(303, `/pesanan/${order.code}`);
  },
};
