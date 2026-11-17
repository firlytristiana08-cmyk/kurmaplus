// Gerbang semua halaman admin: tanpa sesi sah, langsung diarahkan ke
// /admin/masuk (halaman masuk sendiri tetap bisa dibuka).
import { readAdminSession, requireAdmin } from "#lib/server/admin-auth";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies, url }) => {
  if (url.pathname === "/admin/masuk") {
    return { session: await readAdminSession(cookies) };
  }
  const session = await requireAdmin(cookies);
  return { session };
};
