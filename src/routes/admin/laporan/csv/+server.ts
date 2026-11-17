// Ekspor CSV pesanan (AD-21) — endpoint GET agar unduhan berjalan bawaan
// peramban, tanpa unggah ke mana pun, dan tercatat di log audit.

import { adminLogExported, adminOrdersCsvRows } from "#lib/server/admin";
import { requireAdmin } from "#lib/server/admin-auth";
import { toCsv } from "#lib/server/csv";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies, url }) => {
  const session = await requireAdmin(cookies);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new Response("Parameter from/to wajib berformat YYYY-MM-DD.", { status: 400 });
  }
  const rows = await adminOrdersCsvRows(from, to);
  await adminLogExported(from, to, session.email);
  const csv = toCsv(
    [
      "kode",
      "status",
      "dibuat",
      "nama",
      "whatsapp",
      "kota",
      "tanggal_kirim",
      "kurir",
      "status_ongkir",
      "ongkir_idr",
      "total_idr",
      "dibayar_pada",
    ],
    rows,
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kurmaplus-pesanan-${from}-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
};
