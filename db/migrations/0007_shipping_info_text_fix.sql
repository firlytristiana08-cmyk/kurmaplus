-- Penyempurnaan teks info ongkir checkout (tanpa tahun).
UPDATE settings SET value = 'Pengiriman terdekat:
Sabtu & Minggu, 21–22 Nov & Ongkir Grab/Gojek, dibayar langsung ke kurir.'
WHERE key = 'shipping_info_text';
