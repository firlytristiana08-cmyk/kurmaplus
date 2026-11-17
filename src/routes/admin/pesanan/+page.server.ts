// Daftar pesanan dengan filter dan pencarian (PRD Portal Admin — AD-05).
// Filter lewat parameter URL agar bisa dibagikan/di-bookmark.

import { adminListOrders } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, url }) => {
  await requireAdmin(cookies);
  const filter = {
    status: url.searchParams.get("status") ?? undefined,
    deliveryDate: url.searchParams.get("tanggal") ?? undefined,
    courier: url.searchParams.get("kurir") ?? undefined,
    shippingStatus: url.searchParams.get("ongkir") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: Number(url.searchParams.get("hal") ?? "1"),
  };
  return { list: await adminListOrders(filter), filter };
};
