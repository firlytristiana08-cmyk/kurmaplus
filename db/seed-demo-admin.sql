-- DATA DEMO PORTAL ADMIN — hanya untuk pengembangan/preview lokal (SQLite).
-- Melengkapi db/seed-demo.sql: kolom admin pada pesanan demo yang SUDAH ADA,
-- jejak stok, dan contoh log audit. Jalur produksi (Supabase/Postgres) tidak
-- pernah menjalankan berkas ini. Semua data konsisten dengan data demo
-- pelanggan (kode, nama, tanggal kirim, kurir, dan nominal yang sama).

-- Kolom admin pesanan demo: meneruskan kisah tiap status.
UPDATE orders SET shipping_status = 'not_booked', internal_note = 'Demo: tunggu pembayaran dulu sebelum dikemas.' WHERE code = 'DEMO2233';

UPDATE orders SET shipping_status = 'booked', shipping_actual_idr = 25000, courier_booked_at = '2026-11-16T09:20:00.000Z', packed_at = NULL, internal_note = 'Demo: Gojek sudah dipesan untuk Sabtu.' WHERE code = 'DEMO4455';

UPDATE orders SET shipping_status = 'booked', shipping_actual_idr = 28000, courier_booked_at = '2026-11-16T06:00:00.000Z', packed_at = '2026-11-16T05:30:00.000Z', internal_note = 'Demo: paket sudah disiapkan, tunggu hari kirim.' WHERE code = 'DEMO6677';

UPDATE orders SET shipping_status = 'billed', shipping_actual_idr = 22000, courier_booked_at = '2026-11-15T11:30:00.000Z', packed_at = '2026-11-15T11:00:00.000Z', shipped_at = '2026-11-15T12:00:00.000Z', internal_note = 'Demo: ongkir sudah ditagih lewat WhatsApp.' WHERE code = 'DEMO8822';

UPDATE orders SET shipping_status = 'paid', shipping_actual_idr = 30000, courier_booked_at = '2026-11-15T07:00:00.000Z', packed_at = '2026-11-15T06:30:00.000Z', shipped_at = '2026-11-15T08:00:00.000Z', done_at = '2026-11-15T11:00:00.000Z', internal_note = NULL WHERE code = 'DEMO3344';

UPDATE orders SET shipping_status = 'not_booked' WHERE code = 'DEMO7788';

UPDATE orders SET shipping_status = 'not_booked', cancelled_reason = 'Demo: pembeli membatalkan lewat WhatsApp.', refund_noted_at = '2026-11-15T18:00:00.000Z', refund_note = 'Demo: dana dikembalikan via transfer bank, 16 Nov.' WHERE code = 'DEMO5599';

-- Jejak stok: penguncian saat pesanan demo dibuat dan pengembalian untuk
-- pesanan kedaluwarsa/dibatalkan — konsisten dengan stok varian saat ini.
INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, actor, created_at) VALUES
  ('demo-sm-01', 2, -1, 'lock_order', 1, 'sistem', '2026-11-16T11:30:00.000Z'),
  ('demo-sm-02', 7, -1, 'lock_order', 1, 'sistem', '2026-11-16T11:30:00.000Z'),
  ('demo-sm-03', 4, -2, 'lock_order', 2, 'sistem', '2026-11-16T08:50:00.000Z'),
  ('demo-sm-04', 3, -1, 'lock_order', 3, 'sistem', '2026-11-15T13:00:00.000Z'),
  ('demo-sm-05', 8, -2, 'lock_order', 4, 'sistem', '2026-11-15T10:00:00.000Z'),
  ('demo-sm-06', 5, -1, 'lock_order', 5, 'sistem', '2026-11-13T09:00:00.000Z'),
  ('demo-sm-07', 1, -2, 'lock_order', 5, 'sistem', '2026-11-13T09:00:00.000Z'),
  ('demo-sm-08', 9, -1, 'lock_order', 6, 'sistem', '2026-11-14T08:00:00.000Z'),
  ('demo-sm-09', 9, 1, 'expire_return', 6, 'sistem', '2026-11-14T09:00:00.000Z'),
  ('demo-sm-10', 1, -1, 'lock_order', 7, 'sistem', '2026-11-15T15:00:00.000Z'),
  ('demo-sm-11', 1, 1, 'cancel_return', 7, 'sistem', '2026-11-15T16:00:00.000Z'),
  ('demo-sm-12', 6, 1, 'adjustment', NULL, 'pemilik', '2026-11-16T07:00:00.000Z');

-- Contoh log audit (BA-12): hanya-tambah, meniru aksi pemilik dan sistem.
INSERT INTO audit_log (id, actor, entity, entity_id, action, before_json, after_json, created_at) VALUES
  ('demo-log-01', 'sistem', 'order', 'DEMO7788', 'order_expired', '{"status":"pending_payment"}', '{"status":"expired"}', '2026-11-14T09:00:00.000Z'),
  ('demo-log-02', 'pemilik', 'order', 'DEMO5599', 'order_cancelled', '{"status":"paid"}', '{"status":"cancelled","reason":"pembeli membatalkan lewat WhatsApp","stock_restored":true}', '2026-11-15T16:00:00.000Z'),
  ('demo-log-03', 'pemilik', 'order', 'DEMO5599', 'refund_noted', NULL, '{"refund_at":"2026-11-16","note":"dana dikembalikan via transfer bank"}', '2026-11-15T18:00:00.000Z'),
  ('demo-log-04', 'pemilik', 'order', 'DEMO6677', 'status_changed', '{"status":"paid"}', '{"status":"packed"}', '2026-11-16T05:30:00.000Z'),
  ('demo-log-05', 'pemilik', 'order', 'DEMO8822', 'shipping_updated', '{"shipping_status":"booked","shipping_actual_idr":22000}', '{"shipping_status":"billed","shipping_actual_idr":22000}', '2026-11-15T13:00:00.000Z'),
  ('demo-log-06', 'pemilik', 'variant', '6', 'stock_adjusted', '{"stock":3}', '{"stock":4,"delta":1,"reason":"hasil stok opname"}', '2026-11-16T07:00:00.000Z');
