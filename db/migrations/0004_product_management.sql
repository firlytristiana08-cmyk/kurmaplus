-- Manajemen detail produk (tugas 90): foto galeri eksplisit dan tanda
-- Best seller yang diatur admin — menggantikan pola nama berkas '-2/-3.webp'
-- dan aturan "terjual terbanyak" yang hardcoded.
-- Berkas ini dijalankan pelacak schema_migrations di src/lib/server/db.ts;
-- untuk Supabase/Postgres jalankan sekali lewat psql (sintaks sama).

ALTER TABLE products ADD COLUMN photo_2 TEXT;
ALTER TABLE products ADD COLUMN photo_3 TEXT;
ALTER TABLE products ADD COLUMN is_best_seller INTEGER NOT NULL DEFAULT 0;

-- Data lama: galeri mengikuti pola nama berkas yang selama ini dipakai.
UPDATE products SET photo_2 = slug || '-2.webp', photo_3 = slug || '-3.webp';

-- Tanda Best seller awal = produk terjual terbanyak (perilaku lama).
UPDATE products SET is_best_seller = 1 WHERE id = (
  SELECT product_id FROM (
    SELECT v.product_id AS product_id, SUM(oi.qty) AS sold
    FROM order_items oi
    JOIN variants v ON v.id = oi.variant_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('paid', 'packed', 'shipped', 'done')
    GROUP BY v.product_id
    ORDER BY sold DESC
    LIMIT 1
  )
);
