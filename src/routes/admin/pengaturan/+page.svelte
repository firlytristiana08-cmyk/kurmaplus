<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	// Pengaturan toko — dibaca oleh checkout pelanggan (AD-20).
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const s = $derived(data.settings);

	const closedDates = $derived.by(() => {
		try {
			const parsed = JSON.parse(s.closed_dates ?? '[]');
			return Array.isArray(parsed) ? parsed.join(', ') : '';
		} catch {
			return '';
		}
	});
</script>

<svelte:head>
	<title>Pengaturan · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/lainnya" />

<main class="wrap">
	<header class="admin-head">
		<h1>Pengaturan toko</h1>
		<p class="muted page-sub">
			Perubahan berlaku untuk pesanan baru (BA-10, BA-11) dan langsung dibaca checkout pelanggan.
		</p>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}
	{#if form?.saved}
		<p class="info-box">Pengaturan tersimpan dan tercatat di log audit.</p>
	{/if}

	<form method="POST" action="?/simpan" use:enhance>
		<div class="surface">
			<h3 style="margin-top: 0">Toko</h3>
			<div class="field">
				<label for="store_open">Keadaan toko</label>
				<select id="store_open" name="store_open">
					<option value="1" selected={s.store_open !== '0'}>Buka — checkout aktif</option>
					<option value="0" selected={s.store_open === '0'}>Tutup — checkout dinonaktifkan</option>
				</select>
			</div>
			<div class="field">
				<label for="closed_dates">Tanggal libur (pisahkan dengan koma)</label>
				<input id="closed_dates" name="closed_dates" type="text" value={closedDates} placeholder="2026-12-25, 2026-12-26" />
				<p class="hint">Tanggal ini hilang dari pilihan pembeli.</p>
			</div>
			<div class="field">
				<label for="shop_whatsapp">Nomor WhatsApp toko (format 62…)</label>
				<input id="shop_whatsapp" name="shop_whatsapp" type="text" inputmode="numeric" value={s.shop_whatsapp ?? ''} />
			</div>
			<div class="field">
				<label for="shipping_info_text">Teks info ongkir</label>
				<textarea id="shipping_info_text" name="shipping_info_text">{s.shipping_info_text ?? ''}</textarea>
			</div>
		</div>

		<div class="surface">
			<h3 style="margin-top: 0">Pesanan &amp; stok</h3>
			<div class="field">
				<label for="order_cutoff_weekday">Batas pesan — hari (1 = Senin … 7 = Minggu)</label>
				<input id="order_cutoff_weekday" name="order_cutoff_weekday" type="text" inputmode="numeric" value={s.order_cutoff_weekday ?? '4'} />
			</div>
			<div class="field">
				<label for="order_cutoff_time">Batas pesan — jam (HH:MM)</label>
				<input id="order_cutoff_time" name="order_cutoff_time" type="text" value={s.order_cutoff_time ?? '23:59'} />
			</div>
			<div class="field">
				<label for="payment_timeout_minutes">Batas waktu bayar (menit)</label>
				<input id="payment_timeout_minutes" name="payment_timeout_minutes" type="text" inputmode="numeric" value={s.payment_timeout_minutes ?? '60'} />
			</div>
			<div class="field">
				<label for="daily_capacity">Kapasitas harian (pesanan)</label>
				<input id="daily_capacity" name="daily_capacity" type="text" inputmode="numeric" value={s.daily_capacity ?? '20'} />
			</div>
			<div class="field">
				<label for="low_stock_threshold">Ambang stok menipis</label>
				<input id="low_stock_threshold" name="low_stock_threshold" type="text" inputmode="numeric" value={s.low_stock_threshold ?? '10'} />
			</div>
		</div>

		<div class="surface">
			<h3 style="margin-top: 0">Templat pesan WhatsApp</h3>
			<p class="muted">
				Tersedia variabel <code>{'{kode}'}</code>, <code>{'{nama}'}</code>, <code>{'{tanggal}'}</code>,
				dan <code>{'{nominal}'}</code>.
			</p>
			<div class="field">
				<label for="wa_konfirmasi">Konfirmasi pesanan</label>
				<textarea id="wa_konfirmasi" name="wa_konfirmasi">{data.waTemplates.konfirmasi ?? ''}</textarea>
			</div>
			<div class="field">
				<label for="wa_tagih">Tagih ongkir</label>
				<textarea id="wa_tagih" name="wa_tagih">{data.waTemplates.tagih_ongkir ?? ''}</textarea>
			</div>
			<div class="field">
				<label for="wa_pindah">Pindah tanggal</label>
				<textarea id="wa_pindah" name="wa_pindah">{data.waTemplates.pindah_tanggal ?? ''}</textarea>
			</div>
		</div>

		<button class="btn" type="submit">Simpan pengaturan</button>
	</form>
</main>

<div class="page-foot-space"></div>
