// Beranda Hari ini (PRD Portal Admin — AD-01..AD-04): daftar tindakan, rekap
// akhir pekan, stok menipis, dan tombol buka/tutup toko.

import { fail } from "@sveltejs/kit";
import { adminToday, adminToggleStore } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { expireStaleOrders } from "#lib/server/db";
import { diagnoseDoku } from "#lib/server/doku-diag";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  // Sinkronkan status: pesanan yang masa bayarnya habis ikut ditutup sistem.
  await expireStaleOrders(new Date());
  // Status pembayaran daring ditampilkan langsung di Beranda, supaya admin
  // tidak perlu membuka /diagnostics untuk tahu apakah DOKU masih aktif.
  // Nilai rahasia TIDAK dikirim ke peramban — hanya keadaan dan sebabnya.
  const doku = diagnoseDoku(process.env);
  return {
    today: await adminToday(new Date()),
    payment: {
      ok: doku.ok,
      detail: doku.detail,
      action: doku.action,
      reason: doku.code,
    },
  };
};

export const actions: Actions = {
  toko: async ({ cookies, request }) => {
    const session = await requireAdmin(cookies);
    const form = await request.formData();
    const open = String(form.get("open") ?? "") === "1";
    const result = await adminToggleStore(open, session.email);
    if (!result.ok) return fail(400, { message: result.error });
    return { toggled: true };
  },
};
