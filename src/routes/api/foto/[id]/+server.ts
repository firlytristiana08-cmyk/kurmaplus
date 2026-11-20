// Sajikan foto produk dari database (URL data) dengan cache panjang —
// halaman tidak menyematkan URL data di HTML, bobot tetap ringan (tugas 116).
import { error, redirect } from "@sveltejs/kit";
import { getDb } from "#lib/server/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(404, "Foto tidak ditemukan");
  const db = await getDb();
  const row = await db.get<{ data: string }>("SELECT data FROM product_photos WHERE id = ?", [id]);
  if (!row) throw error(404, "Foto tidak ditemukan");
  const value = row.data.trim();
  if (!value.startsWith("data:")) {
    // Nama berkas lama di folder statis.
    throw redirect(302, `/images/${value}`);
  }
  const comma = value.indexOf(",");
  const meta = value.slice(5, comma);
  const isBase64 = meta.endsWith(";base64");
  const mime = meta.replace(";base64", "").trim() || "image/webp";
  const bytes = isBase64
    ? Buffer.from(value.slice(comma + 1), "base64")
    : Buffer.from(decodeURIComponent(value.slice(comma + 1)), "utf8");
  return new Response(bytes, {
    headers: {
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
