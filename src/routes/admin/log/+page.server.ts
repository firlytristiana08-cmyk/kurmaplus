// Log audit (PRD Portal Admin — AD-22, BA-12): hanya bisa disaring dan dibaca.
// Tidak ada aksi ubah atau hapus — log hanya-tambah.

import { adminLogList } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, url }) => {
  await requireAdmin(cookies);
  const filter = {
    entity: url.searchParams.get("objek") ?? undefined,
    action: url.searchParams.get("aksi") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };
  return { entries: await adminLogList(filter), filter };
};
