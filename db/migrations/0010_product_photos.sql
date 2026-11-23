-- Galeri foto produk tak terbatas: satu tabel product_photos (dulunya kolom
-- photo/photo_2/photo_3 yang hanya muat tiga). Data lama dipindahkan apa
-- adanya (nama berkas /images/... atau URL data).
-- Berkas ini dijalankan pelacak schema_migrations di src/lib/server/db.ts;
-- untuk Supabase/Postgres jalankan sekali (sintaks sama).

CREATE TABLE IF NOT EXISTS product_photos (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_photos_product ON product_photos(product_id);

-- Penjaga per-SLOT, bukan per-produk.
--
-- Tanpa penjaga, migrasi yang dijalankan ulang (atau pada database yang
-- galerinya sudah terisi lewat jalur lain) MENDUPLIKASI setiap foto lama.
-- Di produksi berkas ini sempat tercatat "sudah jalan" hanya berdasarkan
-- keberadaan kolom, bukan isi datanya — jadi penjaganya wajib ada.
--
-- Penjaga harus memeriksa SLOT yang sama (sort_order 0/1/2), bukan "apakah
-- produk ini sudah punya foto apa pun". Versi pertama saya memakai bentuk
-- kedua, dan akibatnya pada database baru hanya foto PERTAMA yang tersalin:
-- setelah baris pertama masuk, dua INSERT berikutnya melihat "sudah ada foto"
-- lalu melewati slot 1 dan 2. Tertangkap oleh migrasi.test.ts.
INSERT INTO product_photos (product_id, sort_order, data)
  SELECT p.id, 0, p.photo FROM products p
  WHERE p.photo IS NOT NULL AND p.photo <> ''
    AND NOT EXISTS (
      SELECT 1 FROM product_photos f WHERE f.product_id = p.id AND f.sort_order = 0
    );
INSERT INTO product_photos (product_id, sort_order, data)
  SELECT p.id, 1, p.photo_2 FROM products p
  WHERE p.photo_2 IS NOT NULL AND p.photo_2 <> ''
    AND NOT EXISTS (
      SELECT 1 FROM product_photos f WHERE f.product_id = p.id AND f.sort_order = 1
    );
INSERT INTO product_photos (product_id, sort_order, data)
  SELECT p.id, 2, p.photo_3 FROM products p
  WHERE p.photo_3 IS NOT NULL AND p.photo_3 <> ''
    AND NOT EXISTS (
      SELECT 1 FROM product_photos f WHERE f.product_id = p.id AND f.sort_order = 2
    );
