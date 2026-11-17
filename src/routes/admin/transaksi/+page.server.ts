// Log transaksi pembayaran: riwayat pembayaran DOKU per pesanan.
// Hanya-baca — saring per status, tanpa aksi ubah/hapus.
import { adminTransactionList } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, url }) => {
  await requireAdmin(cookies);
  const status = url.searchParams.get("status") ?? undefined;
  return {
    rows: await adminTransactionList(status ? { paymentStatus: status } : {}),
    filter: status ?? "",
  };
};
