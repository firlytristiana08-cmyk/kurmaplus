-- Performa portal admin: indeks untuk relasi yang paling sering dicari.
-- (Hasil audit — order_items tanpa indeks membuat tiap pengambilan item
-- menjadi pindai penuh tabel, dan riwayat audit per pesanan juga.)
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
