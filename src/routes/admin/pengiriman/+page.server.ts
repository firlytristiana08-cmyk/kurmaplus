// Pengiriman (PRD Portal Admin — AD-15..AD-17): daftar kemas dan daftar antar
// per tanggal kirim, siap dicetak A4 hitam putih.

import { adminDeliveryList, adminPackingList } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { PageServerLoad } from "./$types";

function nextSaturday(now: Date): string {
  const probe = new Date(now.getTime() + 7 * 3_600_000); // zona Asia/Jakarta
  for (let i = 0; i < 14; i++) {
    const d = new Date(probe.getTime() + i * 86_400_000);
    if (d.getUTCDay() === 6) return d.toISOString().slice(0, 10);
  }
  return probe.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ cookies, url }) => {
  await requireAdmin(cookies);
  const date = url.searchParams.get("tanggal") ?? nextSaturday(new Date());
  return {
    date,
    packing: await adminPackingList(date),
    delivery: await adminDeliveryList(date),
  };
};
