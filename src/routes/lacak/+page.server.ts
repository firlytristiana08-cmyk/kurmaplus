import { type Actions, fail, redirect } from "@sveltejs/kit";
import { findOrderByCodeAndPhoneTail } from "#lib/server/db";

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    // Pemaaf terhadap isian tak beraturan: spasi/tanda baca pada kode dibuang,
    // dan kolom WhatsApp menerima 4 digit ATAU nomor penuh (4 digit terakhirnya
    // yang dipakai) — sesuai kebiasaan pembeli mengisi nomornya sendiri.
    const code = String(form.get("code") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const phoneTail = String(form.get("phoneTail") ?? "")
      .replace(/\D/g, "")
      .slice(-4);

    if (!/^[A-Z2-9]{8}$/.test(code) || !/^\d{4}$/.test(phoneTail)) {
      return fail(400, {
        message:
          "Isi kode pesanan 8 karakter dan nomor WhatsApp Anda (4 digit terakhir, atau nomor penuh).",
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
