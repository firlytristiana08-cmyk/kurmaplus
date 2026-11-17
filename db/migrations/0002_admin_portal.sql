-- Skema Portal Admin (PRD Portal Admin — bagian Model data).
-- Menambah kolom ongkir/status kerja pada orders, tabel stock_movements dan
-- audit_log, kunci pengaturan baru, serta indeks kueri admin.
-- Uang = bilangan bulat rupiah. Waktu = UTC ISO-8601 (teks), sama dengan 0001.
-- Berkas ini dijalankan pelacak schema_migrations di src/lib/server/db.ts;
-- untuk Supabase/Postgres jalankan sekali lewat psql (sintaks sama).

ALTER TABLE orders ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'not_booked';
ALTER TABLE orders ADD COLUMN shipping_actual_idr INTEGER;
ALTER TABLE orders ADD COLUMN courier_booked_at TEXT;
ALTER TABLE orders ADD COLUMN internal_note TEXT;
ALTER TABLE orders ADD COLUMN packed_at TEXT;
ALTER TABLE orders ADD COLUMN shipped_at TEXT;
ALTER TABLE orders ADD COLUMN done_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_reason TEXT;
ALTER TABLE orders ADD COLUMN manual_paid_reason TEXT;
ALTER TABLE orders ADD COLUMN refund_noted_at TEXT;
ALTER TABLE orders ADD COLUMN refund_note TEXT;

-- Setiap perubahan stok (kunci pesanan, kembali saat batal/kedaluwarsa,
-- penyesuaian manual) meninggalkan jejak; jumlah baris menjelaskan perubahan.
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Log audit hanya-tambah (BA-12): nilai sebelum dan sesudah dalam JSON teks.
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

-- Email pemilik yang boleh masuk (PRD: dibuat saat setup, diisi dari dashboard
-- Supabase). Diverifikasi bersama sesi Supabase Auth + MFA (aal2).
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status_delivery ON orders(status, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Kunci pengaturan baru (PRD Portal Admin — "Kunci baru pada settings").
INSERT INTO settings (key, value) VALUES ('store_open', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('closed_dates', '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('shop_whatsapp', '6281234567890') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('shipping_info_text', 'Ongkir mengikuti tarif Grab/Gojek — dibayar langsung ke kurir saat paket dikirim, di luar total ini.') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('low_stock_threshold', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('wa_templates', '{"konfirmasi":"Halo {nama}, pesanan {kode} Anda sudah kami terima. Kami siapkan untuk dikirim {tanggal}.","tagih_ongkir":"Halo {nama}, ongkir pesanan {kode} sebesar {nominal}. Mohon dibayar ke kurir saat paket diterima, ya.","pindah_tanggal":"Halo {nama}, pesanan {kode} kami pindah ke tanggal {tanggal}. Mohon kabari bila tidak cocok."}') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('notify_chat_id', '') ON CONFLICT (key) DO NOTHING;
