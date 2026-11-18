-- Email pembeli (input email checkout): dipakai untuk pengiriman detail
-- pesanan dan bukti pembayaran (notifikasi otomatis DOKU). Opsional di
-- tingkat database; formulir checkout mewajibkannya.
-- Berkas ini dijalankan pelacak schema_migrations di src/lib/server/db.ts;
-- untuk Supabase/Postgres jalankan sekali lewat psql (sintaks sama).

ALTER TABLE orders ADD COLUMN email TEXT;
