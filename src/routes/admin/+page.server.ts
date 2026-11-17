// Beranda Hari ini (PRD Portal Admin — AD-01..AD-04): daftar tindakan, rekap
// akhir pekan, stok menipis, dan tombol buka/tutup toko.

import { fail } from "@sveltejs/kit";
import { adminToday, adminToggleStore } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  await requireAdmin(cookies);
  return { today: await adminToday(new Date()) };
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
