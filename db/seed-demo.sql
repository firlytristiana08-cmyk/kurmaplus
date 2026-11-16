-- DATA DEMO — hanya untuk pengembangan/preview lokal (jalur SQLite).
-- Berkas ini dijalankan openSqlite() di src/lib/server/db.ts saat tabel orders
-- masih kosong. Jalur produksi (Supabase/Postgres) TIDAK PERNAH membaca berkas
-- ini, sehingga data contoh tidak mungkin masuk ke produksi.
-- Kode pesanan cocok dengan pola pelacakan ^[A-Z2-9]{8}$.

INSERT INTO orders (id, code, status, customer_name, customer_phone, address, city, lat, lng, courier, delivery_date, subtotal_idr, total_idr, note, created_at, expires_at, paid_at) VALUES
  (1, 'DEMO2233', 'pending_payment', 'Budi Pratama', '081234567890',
   'Jl. Kemang Raya No. 12, gang di samping minimarket', 'Jakarta Selatan',
   -6.2615, 106.8106, 'Grab', '2026-11-21', 180000, 180000,
   'Demo: batas bayar sengaja panjang agar bisa dieksplor.', '2026-11-16T11:30:00.000Z', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+30 days'), NULL),
  (2, 'DEMO4455', 'paid', 'Siti Rahayu', '081398765432',
   'Jl. Tanjung Duren Raya No. 88, lantai 2', 'Jakarta Barat',
   -6.1785, 106.7920, 'Gojek', '2026-11-21', 270000, 270000,
   'Titip ke satpam bila tidak ada orang.', '2026-11-16T08:50:00.000Z', '2026-11-16T09:50:00.000Z', '2026-11-16T09:15:00.000Z'),
  (3, 'DEMO6677', 'packed', 'Andi Wijaya', '081277889900',
   'Perumahan Pondok Indah Blok C2 No. 7', 'Jakarta Timur',
   -6.2215, 106.9020, 'Grab', '2026-11-22', 360000, 360000,
   'Hubungi sebelum sampai.', '2026-11-15T13:00:00.000Z', '2026-11-15T14:00:00.000Z', '2026-11-15T13:20:00.000Z'),
  (4, 'DEMO8822', 'shipped', 'Rina Marlina', '081255667788',
   'Jl. Margonda Raya No. 200, tower B unit 1105', 'Depok',
   -6.3745, 106.8320, 'Gojek', '2026-11-21', 190000, 190000,
   'Patokan: seberang kampus.', '2026-11-15T10:00:00.000Z', '2026-11-15T11:00:00.000Z', '2026-11-15T10:30:00.000Z'),
  (5, 'DEMO3344', 'done', 'Dewi Lestari', '081244332211',
   'Jl. Serpong Raya No. 5', 'Tangerang Selatan',
   -6.2935, 106.7230, 'Grab', '2026-11-15', 391000, 391000,
   NULL, '2026-11-13T09:00:00.000Z', '2026-11-13T10:00:00.000Z', '2026-11-13T09:40:00.000Z'),
  (6, 'DEMO7788', 'expired', 'Rudi Hartono', '081266554433',
   'Jl. Kalimalang No. 9', 'Bekasi',
   -6.2445, 106.9920, 'Grab', '2026-11-22', 264000, 264000,
   'Demo: pesanan kedaluwarsa karena tidak dibayar.', '2026-11-14T08:00:00.000Z', '2026-11-14T09:00:00.000Z', NULL),
  (7, 'DEMO5599', 'cancelled', 'Maya Sari', '081211223344',
   'Jl. Fatmawati No. 33', 'Jakarta Selatan',
   -6.2920, 106.7970, 'Gojek', '2026-11-21', 68000, 68000,
   'Demo: pesanan dibatalkan atas permintaan pembeli.', '2026-11-15T15:00:00.000Z', '2026-11-15T16:00:00.000Z', '2026-11-15T15:30:00.000Z');

INSERT INTO order_items (id, order_id, variant_id, name_snapshot, price_snapshot, qty) VALUES
  (1, 1, 2, 'Kurma Sukari', 128000, 1),
  (2, 1, 7, 'Kurma Tunisia', 52000, 1),
  (3, 2, 4, 'Kurma Ajwa', 135000, 2),
  (4, 3, 3, 'Kurma Sukari', 360000, 1),
  (5, 4, 8, 'Kurma Tunisia', 95000, 2),
  (6, 5, 5, 'Kurma Ajwa', 255000, 1),
  (7, 5, 1, 'Kurma Sukari', 68000, 2),
  (8, 6, 9, 'Kurma Tunisia', 264000, 1),
  (9, 7, 1, 'Kurma Sukari', 68000, 1);

INSERT INTO payments (id, order_id, invoice_number, checkout_url, status, created_at) VALUES
  (1, 1, 'DEMO2233', NULL, 'pending', '2026-11-16T11:30:00.000Z'),
  (2, 2, 'DEMO4455', NULL, 'success', '2026-11-16T08:50:00.000Z'),
  (3, 3, 'DEMO6677', NULL, 'success', '2026-11-15T13:00:00.000Z'),
  (4, 4, 'DEMO8822', NULL, 'success', '2026-11-15T10:00:00.000Z'),
  (5, 5, 'DEMO3344', NULL, 'success', '2026-11-13T09:00:00.000Z'),
  (6, 6, 'DEMO7788', NULL, 'pending', '2026-11-14T08:00:00.000Z'),
  (7, 7, 'DEMO5599', NULL, 'success', '2026-11-15T15:00:00.000Z');
