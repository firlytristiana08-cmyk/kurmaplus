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

INSERT INTO product_photos (product_id, sort_order, data)
  SELECT id, 0, photo FROM products WHERE photo IS NOT NULL AND photo <> '';
INSERT INTO product_photos (product_id, sort_order, data)
  SELECT id, 1, photo_2 FROM products WHERE photo_2 IS NOT NULL AND photo_2 <> '';
INSERT INTO product_photos (product_id, sort_order, data)
  SELECT id, 2, photo_3 FROM products WHERE photo_3 IS NOT NULL AND photo_3 <> '';
