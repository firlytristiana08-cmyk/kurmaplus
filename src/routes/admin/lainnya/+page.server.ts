// Menu Lainnya (PRD — bilah tab: Pengaturan, Laporan, Log).
import { requireAdmin } from "#lib/server/admin-auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  const session = await requireAdmin(cookies);
  return { session };
};
