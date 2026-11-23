<script lang="ts">
	// Hari ini — "layar menjawab satu pertanyaan: apa yang harus dikerjakan
	// sekarang?" (PRD Portal Admin — Arah desain).
	import { enhance } from '$app/forms';
	import { adminEnhance } from '#lib/admin-feedback';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { formatDateId, formatDateTimeId, formatRupiah } from '#lib/format';

	let { data, form } = $props();
	const today = $derived(data.today);

	const actionHint: Record<string, string> = {
		paid: 'Kemas untuk dikirim',
		packed: 'Pesan pengiriman & antar',
		shipped: 'Pastikan diterima & tagih ongkir',
	};
</script>

<svelte:head>
	<title>Hari ini · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<h1>Hari ini</h1>
		<p class="muted page-sub">{formatDateId(today.openCheckoutDate)} · zona Asia/Jakarta</p>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}

	<!-- Ringkasan pendapatan. Ongkir TIDAK dihitung (BA-06): ongkir ditagih
	     terpisah ke kurir, bukan bagian dari omzet. Angka "Lunas" sengaja
	     memakai total pesanan berbayar (termasuk yang sudah selesai) supaya
	     tidak turun saat pesanan berpindah ke status selesai. -->
	<div class="section-head">
		<h2>Pendapatan</h2>
		<a href="/admin/laporan">Laporan per periode</a>
	</div>
	<div class="surface">
		<div class="recap-line">
			<span class="day">Total lunas</span>
			<span class="sum tabular">
				{formatRupiah(today.revenue.totalIdr)}
				<span class="muted" style="font-weight: 400">
					· {today.revenue.orderCount} pesanan
				</span>
			</span>
		</div>
		<div class="recap-line">
			<span class="day">Hari ini</span>
			<span class="sum tabular">
				{formatRupiah(today.revenue.todayIdr)}
				<span class="muted" style="font-weight: 400">
					· {today.revenue.todayCount} pesanan
				</span>
			</span>
		</div>
		<div class="recap-line">
			<span class="day">30 hari terakhir</span>
			<span class="sum tabular">{formatRupiah(today.revenue.last30Idr)}</span>
		</div>
		<div class="recap-line">
			<span class="day">Masih dikerjakan</span>
			<span class="sum tabular">{formatRupiah(today.revenue.inProgressIdr)}</span>
		</div>
		<p class="hint" style="margin: 0.5rem 0 0">
			Tanpa ongkir — ongkir ditagih terpisah ke kurir. "Masih dikerjakan" adalah bagian dari
			total lunas yang belum selesai.
		</p>
	</div>

	<!-- Status pembayaran daring: satu baris, selalu terlihat. Sebelumnya
	     admin harus membuka /diagnostics untuk tahu DOKU mati atau hidup. -->
	{#if data.payment.ok}
		<p style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0 0 1rem">
			<span class="badge badge-ok">Pembayaran DOKU aktif</span>
			<span class="muted">Pembeli diarahkan ke halaman bayar DOKU saat checkout.</span>
		</p>
	{:else}
		<div class="surface" style="border-color: var(--rust)">
			<p style="margin: 0 0 0.375rem">
				<span class="badge badge-alert">Pembayaran DOKU belum aktif</span>
			</p>
			<p style="margin: 0 0 0.5rem">{data.payment.detail}</p>
			{#if data.payment.action}
				<p class="hint" style="margin: 0">
					<strong>Tindakan:</strong>
					{data.payment.action}
				</p>
			{/if}
			<p class="hint" style="margin: 0.5rem 0 0">
				Pesanan tetap tersimpan dan bisa dibayar dari halaman pesanan pembeli, jadi tidak ada dana
				yang hilang.
			</p>
		</div>
	{/if}

	<!-- Ringkasan pesanan: angka per status — klik membuka daftar terfilter. -->
	<div class="section-head">
		<h2>Ringkasan pesanan</h2>
		<a href="/admin/pesanan">Semua pesanan</a>
	</div>
	<div class="chip-row">
		<a class="chip" href="/admin/pesanan?status=pending_payment">Menunggu bayar <strong class="tabular">{today.counts.pending_payment}</strong></a>
		<a class="chip" href="/admin/pesanan?status=paid">Perlu dikemas <strong class="tabular">{today.counts.paid}</strong></a>
		<a class="chip" href="/admin/pesanan?status=packed">Siap kirim <strong class="tabular">{today.counts.packed}</strong></a>
		<a class="chip" href="/admin/pesanan?status=shipped">Terkirim <strong class="tabular">{today.counts.shipped}</strong></a>
	</div>

	<!-- Perlu tindakan (AD-01) -->
	<div class="section-head">
		<h2>Perlu tindakan</h2>
		<a href="/admin/pesanan">Semua pesanan</a>
	</div>
	<div class="surface">
		{#if today.needAction.length === 0}
			<p class="muted" style="margin: 0">Belum ada pesanan yang menunggu tindakan.</p>
		{:else}
			{#each today.needAction as order (order.code)}
				<a class="row" href={`/admin/pesanan/${order.code}`}>
					<div class="row-main">
						<div class="row-l1">
							{order.code} · {order.customerName}
							<StatusBadge status={order.status} />
							<span class="muted">{formatDateTimeId(order.createdAt)}</span>
						</div>
						<div class="row-l2">
							{actionHint[order.status] ?? 'Tindak lanjuti'} · {formatDateId(order.deliveryDate)} ·
							{order.city} · {formatRupiah(order.totalIdr)}
						</div>
					</div>
					<div class="row-side" aria-hidden="true">›</div>
				</a>
			{/each}
		{/if}
	</div>

	<!-- Rekap akhir pekan (AD-02) -->
	<div class="section-head">
		<h2>Akhir pekan ini</h2>
	</div>
	<div class="surface">
		{#each today.weekend as day (day.date)}
			<div class="recap-line">
				<span class="day">{day.weekdayName}, {formatDateId(day.date)}</span>
				<span class="sum tabular">
					{day.orderCount} pesanan · {day.packageCount} kemasan<br />
					antar:
					{#if Object.keys(day.perCourier).length === 0}—{:else}{Object.entries(day.perCourier).map(([k, v]) => `${k} ${v}`).join(' · ')}{/if}
				</span>
			</div>
		{/each}
	</div>

	<!-- Stok menipis (AD-03) -->
	<div class="section-head">
		<h2>Stok menipis</h2>
		<a href="/admin/produk">Kelola stok</a>
	</div>
	<div class="surface">
		{#if today.lowStock.length === 0}
			<p class="muted" style="margin: 0">Semua varian di atas ambang {today.threshold}.</p>
		{:else}
			{#each today.lowStock as row (row.variantId)}
				<div class="row">
					<div class="row-main">
						<div class="row-l1">
							{row.productName} {row.label}
							<span class="badge badge-alert">
								<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M0.5 0.5 11.5 11.5M11.5 0.5 0.5 11.5" stroke="currentColor" stroke-width="2.4" /></svg>
								Sisa {row.stock}
							</span>
						</div>
						<div class="row-l2">Ambang {today.threshold}{row.locked > 0 ? ` · ${row.locked} terkunci pesanan menunggu bayar` : ''}</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Keadaan toko (AD-04) -->
	<div class="surface">
		<div class="row" style="border-bottom: none; padding: 0">
			<div class="row-main">
				<div class="row-l1">
					<span class="badge {today.storeOpen ? 'badge-ok' : 'badge-off'}">
						<svg class="mk" viewBox="0 0 12 12" aria-hidden="true">
							{#if today.storeOpen}<circle cx="6" cy="6" r="5" fill="currentColor" />{:else}<path d="M0.5 0.5 11.5 11.5M11.5 0.5 0.5 11.5" stroke="currentColor" stroke-width="2.4" />{/if}
						</svg>
						{today.storeOpen ? 'Toko buka' : 'Toko tutup'}
					</span>
				</div>
				<div class="row-l2">
					{today.storeOpen
						? 'Checkout pelanggan aktif.'
						: 'Checkout pelanggan dinonaktifkan dengan pesan tutup.'}
				</div>
			</div>
			<form method="POST" action="?/toko" use:enhance={adminEnhance('Status toko diperbarui.')}>
				<input type="hidden" name="open" value={today.storeOpen ? '0' : '1'} />
				<button class="btn-mini" type="submit">{today.storeOpen ? 'Tutup toko' : 'Buka toko'}</button>
			</form>
		</div>
	</div>
</main>

<div class="page-foot-space"></div>
