-- Teks info ongkir di halaman checkout: baris pertama tampil tebal.
UPDATE settings SET value = 'Pengiriman terdekat:
Sabtu & Minggu, 21–22 Nov 2026. Dan ongkir Grab/Gojek, dibayar langsung ke kurir.'
WHERE key = 'shipping_info_text';
