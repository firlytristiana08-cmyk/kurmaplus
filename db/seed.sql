-- Data awal portal pelanggan KURMAPLUS.
-- Harga, stok, dan nomor WhatsApp pemilik BERSIFAT SEMENTARA dan wajib
-- dikonfirmasi pemilik sebelum rilis (lihat DECISIONS.md).

INSERT INTO products (id, slug, name, description, photo, sort_order, is_active) VALUES
  (1, 'sukari', 'Kurma Sukari',
   'Sukari dari Al-Qassim, Arab Saudi. Butir sedang berwarna cokelat muda keemasan, tekstur lembut agak kenyal, rasa manis seperti karamel dengan kandungan air yang cukup sehingga terasa lembap. Simpan dalam wadah kedap di suhu ruang, atau di kulkas bila ingin lebih padat.',
   'sukari.webp', 1, 1),
  (2, 'ajwa', 'Kurma Ajwa',
   'Ajwa dari Madinah, Arab Saudi. Butir kecil berwarna hitam pekat, permukaan sedikit kering namun isinya lembut, rasa manis pekat dengan sedikit rasa rempah. Simpan di tempat sejuk dan kering, hindari panas matahari langsung.',
   'ajwa.webp', 2, 1),
  (3, 'tunisia', 'Kurma Tunisia',
   'Kurma Tunisia jenis Deglet Nour. Butir sedang agak panjang berwarna cokelat keemasan yang sedikit bening, tekstur semi-kering berserat halus, rasa manis ringan yang bersahaja. Tahan lama disimpan di suhu ruang dalam wadah tertutup.',
   'tunisia.webp', 3, 1);

INSERT INTO variants (id, product_id, label, weight_grams, price_idr, stock, is_active) VALUES
  (1, 1, '500 gr', 500, 68000, 24, 1),
  (2, 1, '1 kg', 1000, 128000, 18, 1),
  (3, 1, '3 kg', 3000, 360000, 6, 1),
  (4, 2, '500 gr', 500, 135000, 15, 1),
  (5, 2, '1 kg', 1000, 255000, 12, 1),
  (6, 2, '3 kg', 3000, 720000, 4, 1),
  (7, 3, '500 gr', 500, 52000, 30, 1),
  (8, 3, '1 kg', 1000, 95000, 20, 1),
  (9, 3, '3 kg', 3000, 264000, 8, 1);

INSERT INTO settings (key, value) VALUES
  ('order_cutoff_weekday', '4'),
  ('order_cutoff_time', '23:59'),
  ('payment_timeout_minutes', '60'),
  ('daily_capacity', '20'),
  ('geo_bounds_min_lat', '-6.95'),
  ('geo_bounds_max_lat', '-5.85'),
  ('geo_bounds_min_lng', '106.25'),
  ('geo_bounds_max_lng', '107.45'),
  ('whatsapp_owner', '6281234567890');
