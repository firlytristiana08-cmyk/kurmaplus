// Laporan periode (PRD Portal Admin — AD-21). Ekspor CSV berada di
// ./csv/+server.ts (unduhan bawaan peramban, tercatat di log audit).

import { adminReport } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import type { PageServerLoad } from "./$types";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export const load: PageServerLoad = async ({ cookies, url }) => {
  await requireAdmin(cookies);
  const fallback = monthRange();
  const from = url.searchParams.get("from") ?? fallback.from;
  const to = url.searchParams.get("to") ?? fallback.to;
  return { report: await adminReport(from, to) };
};
