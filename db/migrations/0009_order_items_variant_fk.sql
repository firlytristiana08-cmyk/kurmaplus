-- Hapus ketergantungan FK order_items.variant_id -> variants(id) supaya produk
-- dan varian dapat dihapus permanen sementara riwayat pesanan tetap utuh
-- (nama & harga sudah tersimpan sebagai snapshot saat transaksi).
-- Berkas ini dijalankan pelacak schema_migrations di src/lib/server/db.ts.
-- Untuk Supabase/Postgres jalankan sekali:
--   ALTER TABLE order_items DROP CONSTRAINT order_items_variant_id_fkey;

CREATE TABLE order_items_new (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  variant_id INTEGER NOT NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

INSERT INTO order_items_new (id, order_id, variant_id, name_snapshot, price_snapshot, qty)
  SELECT id, order_id, variant_id, name_snapshot, price_snapshot, qty FROM order_items;

DROP TABLE order_items;

ALTER TABLE order_items_new RENAME TO order_items;
