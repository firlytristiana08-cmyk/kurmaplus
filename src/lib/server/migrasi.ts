/**
 * Migrasi database sebagai MODUL, bukan berkas di disk.
 *
 * Kenapa berkas terpisah tidak bisa dipakai di produksi: pelari migrasi membaca
 * `db/migrations` dari disk, sedangkan `vite build` tidak menyalin folder `db/`
 * ke bundel Worker, dan di Cloudflare Workers tidak ada `process.cwd()` yang
 * menunjuk ke akar proyek. Akibatnya pembacaan folder gagal — galatnya ditelan
 * penjaga agar situs tetap hidup — dan skema produksi tidak pernah menerima
 * migrasi apa pun. Terbukti di produksi: `schema_migrations` kosong padahal
 * aplikasi berjalan normal.
 *
 * Berkas ini adalah SATU-SATUNYA sumber migrasi untuk kedua jalur (SQLite lokal
 * dan Postgres produksi), jadi keduanya tidak mungkin berbeda. Isinya SQL yang
 * sama dengan `db/migrations/*.sql`; itulah yang diperiksa `migrasi.test.ts`
 * supaya salinan ini tidak pernah menyimpang tanpa ketahuan.
 *
 * JANGAN mengubah isi entri yang sudah pernah berjalan: pelacak
 * `schema_migrations` menyimpan NAMA berkas. Mengubah isi berkas yang sudah
 * tercatat berarti perubahannya tidak akan pernah sampai ke database yang sudah
 * memakainya. Tambahkan entri baru di akhir.
 */

export interface MigrasiBerkas {
  /** Nama berkas asli — dipakai sebagai kunci `schema_migrations`. */
  name: string;
  /** Satu pernyataan SQL per elemen; tidak ada yang berisi lebih dari satu. */
  statements: string[];
}

/**
 * Pisahkan isi berkas .sql menjadi pernyataan.
 *
 * Dipakai untuk menyusun daftar di bawah dari berkas aslinya, dan oleh
 * `migrasi.test.ts` untuk memastikan salinan ini sama dengan sumbernya.
 */
export function pisahPernyataan(isiBerkas: string): string[] {
  return isiBerkas
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*(?:--.*\r?\n)+/gm, "").trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
}

/**
 * SQL yang dipakai bersama SQLite dan Postgres.
 *
 * Catatan sintaks:
 * - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` HANYA untuk Postgres. SQLite
 *   menolaknya (sudah diuji: `near "EXISTS": syntax error`), jadi pelari
 *   Postgres membuang klausa itu dan memeriksa `information_schema` lebih dulu.
 * - `ON CONFLICT ... DO NOTHING` juga hanya Postgres — SQLite menolaknya
 *   (`near "DO"`). Pengulangan dijaga pelacak `schema_migrations`, dan seed
 *   memakai `WHERE NOT EXISTS`.
 * - `CREATE TABLE/INDEX IF NOT EXISTS` aman di keduanya.
 */
export const MIGRASI: readonly MigrasiBerkas[] = [
  {
    name: "0001_init.sql",
    statements: [
      `CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  photo TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
)`,
      `CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  label TEXT NOT NULL,
  weight_grams INTEGER NOT NULL,
  price_idr INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
)`,
      `CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  courier TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  subtotal_idr INTEGER NOT NULL,
  total_idr INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  paid_at TEXT
)`,
      `CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  name_snapshot TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  qty INTEGER NOT NULL
)`,
      `CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  invoice_number TEXT NOT NULL,
  checkout_url TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
      `CREATE TABLE IF NOT EXISTS webhook_events (
  request_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
)`,
      `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status_expires ON orders(status, expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id)`,
    ],
  },
  {
    name: "0002_admin_portal.sql",
    statements: [
      `ALTER TABLE orders ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'not_booked'`,
      `ALTER TABLE orders ADD COLUMN shipping_actual_idr INTEGER`,
      `ALTER TABLE orders ADD COLUMN courier_booked_at TEXT`,
      `ALTER TABLE orders ADD COLUMN internal_note TEXT`,
      `ALTER TABLE orders ADD COLUMN packed_at TEXT`,
      `ALTER TABLE orders ADD COLUMN shipped_at TEXT`,
      `ALTER TABLE orders ADD COLUMN done_at TEXT`,
      `ALTER TABLE orders ADD COLUMN cancelled_reason TEXT`,
      `ALTER TABLE orders ADD COLUMN manual_paid_reason TEXT`,
      `ALTER TABLE orders ADD COLUMN refund_noted_at TEXT`,
      `ALTER TABLE orders ADD COLUMN refund_note TEXT`,
      `CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
      `CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
)`,
      `CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status_delivery ON orders(status, delivery_date)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone)`,
      `CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`,
      `INSERT INTO settings (key, value) VALUES ('store_open', '1') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings (key, value) VALUES ('closed_dates', '[]') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings (key, value) VALUES ('shop_whatsapp', '6281234567890') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings (key, value) VALUES ('shipping_info_text', 'Ongkir mengikuti tarif Grab/Gojek — dibayar langsung ke kurir saat paket dikirim, di luar total ini.') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings (key, value) VALUES ('low_stock_threshold', '10') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings (key, value) VALUES ('wa_templates', '{"konfirmasi":"Halo {nama}, pesanan {kode} Anda sudah kami terima. Kami siapkan untuk dikirim {tanggal}.","tagih_ongkir":"Halo {nama}, ongkir pesanan {kode} sebesar {nominal}. Mohon dibayar ke kurir saat paket diterima, ya.","pindah_tanggal":"Halo {nama}, pesanan {kode} kami pindah ke tanggal {tanggal}. Mohon kabari bila tidak cocok."}') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings (key, value) VALUES ('notify_chat_id', '') ON CONFLICT (key) DO NOTHING`,
    ],
  },
  {
    name: "0003_shipping_text.sql",
    statements: [
      `UPDATE settings
SET value = 'Ongkir mengikuti tarif Grab/Gojek — dibayar langsung ke kurir saat paket dikirim, di luar total ini.'
WHERE key = 'shipping_info_text'`,
    ],
  },
  {
    name: "0004_product_management.sql",
    statements: [
      `ALTER TABLE products ADD COLUMN photo_2 TEXT`,
      `ALTER TABLE products ADD COLUMN photo_3 TEXT`,
      `ALTER TABLE products ADD COLUMN is_best_seller INTEGER NOT NULL DEFAULT 0`,
      `UPDATE products SET photo_2 = slug || '-2.webp', photo_3 = slug || '-3.webp'`,
      `UPDATE products SET is_best_seller = 1 WHERE id = (
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
)`,
    ],
  },
  {
    name: "0005_order_email.sql",
    statements: [`ALTER TABLE orders ADD COLUMN email TEXT`],
  },
  {
    name: "0006_shipping_info_text.sql",
    statements: [
      `UPDATE settings SET value = 'Pengiriman terdekat:
Sabtu & Minggu, 21–22 Nov 2026. Dan ongkir Grab/Gojek, dibayar langsung ke kurir.'
WHERE key = 'shipping_info_text'`,
    ],
  },
  {
    name: "0007_shipping_info_text_fix.sql",
    statements: [
      `UPDATE settings SET value = 'Pengiriman terdekat:
Sabtu & Minggu, 21–22 Nov & Ongkir Grab/Gojek, dibayar langsung ke kurir.'
WHERE key = 'shipping_info_text'`,
    ],
  },
  {
    name: "0008_admin_perf_indexes.sql",
    statements: [
      `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id)`,
    ],
  },
  {
    name: "0009_order_items_variant_fk.sql",
    statements: [
      `CREATE TABLE order_items_new (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  variant_id INTEGER NOT NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  qty INTEGER NOT NULL
)`,
      `INSERT INTO order_items_new (id, order_id, variant_id, name_snapshot, price_snapshot, qty)
  SELECT id, order_id, variant_id, name_snapshot, price_snapshot, qty FROM order_items`,
      `DROP TABLE order_items`,
      `ALTER TABLE order_items_new RENAME TO order_items`,
    ],
  },
  {
    name: "0010_product_photos.sql",
    statements: [
      `CREATE TABLE IF NOT EXISTS product_photos (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
)`,
      `CREATE INDEX IF NOT EXISTS idx_product_photos_product ON product_photos(product_id)`,
      `INSERT INTO product_photos (product_id, sort_order, data)
  SELECT p.id, 0, p.photo FROM products p
  WHERE p.photo IS NOT NULL AND p.photo <> ''
    AND NOT EXISTS (
      SELECT 1 FROM product_photos f WHERE f.product_id = p.id AND f.sort_order = 0
    )`,
      `INSERT INTO product_photos (product_id, sort_order, data)
  SELECT p.id, 1, p.photo_2 FROM products p
  WHERE p.photo_2 IS NOT NULL AND p.photo_2 <> ''
    AND NOT EXISTS (
      SELECT 1 FROM product_photos f WHERE f.product_id = p.id AND f.sort_order = 1
    )`,
      `INSERT INTO product_photos (product_id, sort_order, data)
  SELECT p.id, 2, p.photo_3 FROM products p
  WHERE p.photo_3 IS NOT NULL AND p.photo_3 <> ''
    AND NOT EXISTS (
      SELECT 1 FROM product_photos f WHERE f.product_id = p.id AND f.sort_order = 2
    )`,
    ],
  },
  {
    name: "0011_photo_tiers.sql",
    statements: [
      `ALTER TABLE product_photos ADD COLUMN data_sm TEXT`,
      `ALTER TABLE product_photos ADD COLUMN data_md TEXT`,
    ],
  },
  {
    name: "0012_photo_seq_dan_versi.sql",
    statements: [
      `CREATE TABLE IF NOT EXISTS product_photo_seq (
  id INTEGER PRIMARY KEY,
  next_id INTEGER NOT NULL DEFAULT 0
)`,
      `INSERT INTO product_photo_seq (id, next_id)
  SELECT 1, COALESCE(MAX(id), 0) FROM product_photos
  WHERE NOT EXISTS (SELECT 1 FROM product_photo_seq WHERE id = 1)`,
      `ALTER TABLE product_photos ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
    ],
  },
];
