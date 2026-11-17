-- Teks info ongkir dipersingkat (permintaan pengguna): satu kalimat padat.
UPDATE settings
SET value = 'Ongkir mengikuti tarif Grab/Gojek — dibayar langsung ke kurir saat paket dikirim, di luar total ini.'
WHERE key = 'shipping_info_text';
