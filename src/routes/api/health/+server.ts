// Pemeriksaan kesehatan sederhana untuk operasional: menguji koneksi database
// dan melaporkan kode galat (tanpa pesan/sandi) agar mudah didiagnosis.
// Alasan file ini ada: diagnosis koneksi produksi dari luar tanpa akses log.

import { json } from "@sveltejs/kit";
import { getDb } from "#lib/server/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  try {
    const db = await getDb();
    await db.get("SELECT 1 AS ok");
    return json({ ok: true });
  } catch (error) {
    const code = (error as { code?: string }).code ?? (error as Error).name;
    return json({ ok: false, code }, { status: 503 });
  }
};
