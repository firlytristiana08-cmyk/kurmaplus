-- Varian ukuran foto responsif (tugas responsif): simpan turunan 600px dan
-- 1200px per foto supaya halaman bisa memakai srcset — browser pembeli memilih
-- ukuran paling pas dengan layarnya. Foto lama tetap memakai kolom data apa
-- adanya (endpoint /api/foto/{id} memilih turunan bila ada).
-- Berkas ini dijalankan pelacak schema_migrations di src/lib/server/db.ts;
-- untuk Supabase/Postgres jalankan sekali (sintaks sama).

ALTER TABLE product_photos ADD COLUMN data_sm TEXT;
ALTER TABLE product_photos ADD COLUMN data_md TEXT;
