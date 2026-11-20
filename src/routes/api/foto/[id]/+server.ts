// Sajikan foto produk dari database (URL data) dengan cache panjang —
// halaman tidak menyematkan URL data di HTML, bobot tetap ringan (tugas 116).
import { error } from "@sveltejs/kit";
import { pickPhotoTier } from "#lib/photos";
import { getDb } from "#lib/server/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(404, "Foto tidak ditemukan");
  const db = await getDb();
  const row = await db.get<{ data: string; data_sm: string | null; data_md: string | null }>(
    "SELECT data, data_sm, data_md FROM product_photos WHERE id = ?",
    [id],
  );
  if (!row) throw error(404, "Foto tidak ditemukan");
  // ?w= meminta tingkat ukuran (600/1200/1600) untuk srcset; tanpa w kembali
  // ke ukuran terbesar seperti sebelumnya.
  const w = Number(url.searchParams.get("w") ?? 0);
  const value = pickPhotoTier(
    row.data,
    row.data_sm,
    row.data_md,
    Number.isFinite(w) ? w : 0,
  ).trim();
  if (!value.startsWith("data:")) {
    // Nama berkas lama di folder statis — arahkan dengan cache singkat agar
    // galeri tidak bolak-balik ke database di tiap gambar.
    return new Response(null, {
      status: 302,
      headers: {
        location: `/images/${value}`,
        "cache-control": "public, max-age=86400",
      },
    });
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
