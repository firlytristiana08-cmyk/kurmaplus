-- Urutan id foto: id tidak boleh dipakai ulang.
--
-- Latar: id foto dulu dibuat dengan MAX(id) + 1. Karena foto produk diganti
-- dengan hapus-lalu-tambah, penghapusan foto berid TERBESAR membuat id itu
-- dipakai kembali oleh foto pengganti. URL foto jadi sama persis dengan
-- sebelumnya — dan karena endpoint mengirim `max-age=31536000, immutable`
-- serta service worker menyimpan gambar lebih dulu daripada jaringan, foto
-- pengganti tidak pernah terlihat oleh pembeli.
--
-- Tabel ini menyimpan penghasil id yang hanya bergerak maju. Id yang sudah
-- pernah dipakai tidak akan dipakai lagi, sehingga URL foto selalu baru saat
-- isinya berubah.
--
-- CATATAN SINTEKS: tidak memakai `ADD COLUMN IF NOT EXISTS` karena SQLite
-- menolaknya (syntax error); pelari migrasi Postgres memeriksa kolom lebih
-- dulu sebelum menjalankan ALTER.

CREATE TABLE IF NOT EXISTS product_photo_seq (
  id INTEGER PRIMARY KEY,
  next_id INTEGER NOT NULL DEFAULT 0
);

-- Mulai dari id tertinggi yang sudah ada, supaya database yang dibuat dengan
-- MAX(id)+1 tidak bertabrakan dengan urutan baru.
--
-- Tidak memakai `ON CONFLICT ... DO NOTHING`: itu sintaks Postgres dan SQLite
-- menolaknya (near "DO": syntax error). Pengulangan dijaga oleh schema_migrations
-- di SQLite, sedangkan pelari Postgres melewati berkas yang sudah tercatat.
INSERT INTO product_photo_seq (id, next_id)
  SELECT 1, COALESCE(MAX(id), 0) FROM product_photos
  WHERE NOT EXISTS (SELECT 1 FROM product_photo_seq WHERE id = 1);

-- Kolom versi: penanda yang ikut ke URL foto (?v=). Naik saat isi foto berubah.
--
-- Kenapa tetap perlu meski id sudah unik: foto yang SAMA bisa saja disimpan
-- ulang dengan id berbeda (mis. seluruh galeri produk diganti), dan tanpa
-- versi tidak ada cara membedakan "foto baru" dari "foto lama di URL baru".
-- Versi membuat maksud itu eksplisit dan terbaca di URL.
--
-- Ditulis tanpa IF NOT EXISTS (SQLite menolaknya). Pelari migrasi Postgres
-- memeriksa information_schema lebih dulu; galat 42701 (sudah ada) ditelan.
ALTER TABLE product_photos ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
