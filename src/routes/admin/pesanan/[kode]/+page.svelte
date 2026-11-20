<script lang="ts">
	import { tick } from 'svelte';
	// Detail pesanan — "layar menjawab: apa langkah berikut untuk satu pesanan?"
	// (PRD Portal Admin — AD-06..AD-14, BA-01..BA-07).
	import { enhance } from '$app/forms';
	import { adminEnhance } from '#lib/admin-feedback';
	import BackLink from '#lib/components/BackLink.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import type { OrderStatus } from '#lib/order-status';
	import { formatDateId, formatDateTimeId, formatRupiah } from '#lib/format';

	let { data, form } = $props();
	const order = $derived(data.order);

	const forward: Partial<Record<OrderStatus, OrderStatus>> = {
		paid: 'packed',
		packed: 'shipped',
		shipped: 'done',
	};
	const backward: Partial<Record<OrderStatus, OrderStatus>> = {
		packed: 'paid',
		shipped: 'packed',
		done: 'shipped',
	};
	const forwardLabel: Record<string, string> = {
		packed: 'Tandai dikemas',
		shipped: 'Tandai dikirim',
		done: 'Tandai selesai',
	};
	const nextHint: Partial<Record<OrderStatus, string>> = {
		pending_payment: 'Tunggu pembayaran — atau tandai dibayar manual setelah memeriksa DOKU.',
		paid: 'Kemas pesanan ini, lalu tandai dikemas.',
		packed: 'Pesan kurir sesuai pilihan pembeli, lalu tandai dikirim.',
		shipped: 'Pastikan paket diterima, tagih ongkir, lalu tandai selesai.',
		done: 'Selesai. Riwayat tetap tersimpan.',
		expired: 'Kedaluwarsa — stok sudah dikembalikan sistem.',
		cancelled: 'Dibatalkan. Catat pengembalian bila dana sudah dikembalikan.',
	};

	const phone62 = $derived(
		order.customerPhone.startsWith('0') ? `62${order.customerPhone.slice(1)}` : order.customerPhone,
	);

	function waText(templateKey: string): string {
		const template: string = data.waTemplates[templateKey] ?? '';
		return template
			.replaceAll('{nama}', order.customerName)
			.replaceAll('{kode}', order.code)
			.replaceAll('{tanggal}', formatDateId(order.deliveryDate))
			.replaceAll('{nominal}', formatRupiah(order.shippingActualIdr ?? 0));
	}

	function waLink(templateKey: string): string {
		return `https://wa.me/${phone62}?text=${encodeURIComponent(waText(templateKey))}`;
	}

	const mapsLink = $derived(
		`https://www.google.com/maps?q=${order.lat},${order.lng}`,
	);

	const shippingSteps: { key: string; label: string }[] = [
		{ key: 'not_booked', label: 'Belum dipesan' },
		{ key: 'booked', label: 'Kurir dipesan' },
		{ key: 'billed', label: 'Ditagih' },
		{ key: 'paid', label: 'Lunas' },
	];
	const shippingIndex = $derived(shippingSteps.findIndex((s) => s.key === order.shippingStatus));

	async function copyText(text: string, label: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			window.dispatchEvent(new CustomEvent('kurma:toast', { detail: `${label} tersalin.` }));
		} catch {
			window.alert(`${label} gagal disalin — salin manual.`);
		}
	}

	const actionLabel: Record<string, string> = {
		status_changed: 'Status diubah',
		order_cancelled: 'Pesanan dibatalkan',
		manual_paid: 'Ditandai bayar manual',
		shipping_updated: 'Ongkir diperbarui',
		delivery_moved: 'Tanggal kirim dipindah',
		internal_note_saved: 'Catatan internal disimpan',
		refund_noted: 'Pengembalian dana dicatat',
		order_expired: 'Kedaluwarsa (sistem)',
	};
	// Cetak slip pesanan — satu lembar A4 berisi item pesanan, informasi
	// pemesan, dan pengiriman saja.
	let printing = $state(false);
	const kemasanCount = $derived(order.items.reduce((n, it) => n + it.qty, 0));

	async function printSlip(): Promise<void> {
		printing = true;
		const cleanup = (): void => {
			printing = false;
			window.removeEventListener('afterprint', cleanup);
		};
		window.addEventListener('afterprint', cleanup);
		await tick();
		window.print();
		// Jaga-jaga bila peramban tidak memblokir print() dan tidak mengirim afterprint.
		setTimeout(cleanup, 1500);
	}
</script>

<svelte:head>
	<title>Pesanan {order.code} · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/pesanan" />

<main class="wrap" class:no-print={printing}>
	<header class="admin-head">
		<h1>Pesanan {order.code}</h1>
		<p class="row-l1" style="margin: 0 0 0.25rem">
			<StatusBadge status={order.status} />
			<span class="muted">Dibuat {formatDateTimeId(order.createdAt)}</span>
		</p>
		<p class="muted page-sub">Langkah berikut: {nextHint[order.status]}</p>
	</header>

	<div class="btn-row">
		<button class="btn-mini" type="button" onclick={() => void printSlip()}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6v2H9zm0 4h6v2H9z"/></svg>
			Cetak
		</button>
	</div>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}
	{#if form?.doku}
		<p class="info-box">
			Hasil cek DOKU{form.doku.preview ? ' (pratinjau — tanpa kunci DOKU)' : ''}:
			transaksi <strong>{form.doku.transactionStatus}</strong>, pesanan
			<strong>{form.doku.orderStatus ?? '—'}</strong>.
		</p>
	{/if}

	<!-- Item (AD-06) -->
	<div class="surface">
		<h3 style="margin-top: 0">Item</h3>
		{#each order.items as item (item.name + item.priceIdr)}
			<div class="row">
				<div class="row-main">
					<div class="row-l1">{item.name}</div>
					<div class="row-l2 tabular">{item.qty} × {formatRupiah(item.priceIdr)}</div>
				</div>
				<div class="row-side tabular">{formatRupiah(item.priceIdr * item.qty)}</div>
			</div>
		{/each}
		<hr class="divider" />
		<div class="row" style="border-bottom: none">
			<div class="row-main"><strong>Total pesanan</strong></div>
			<div class="row-side tabular"><strong>{formatRupiah(order.totalIdr)}</strong></div>
		</div>
		<p class="muted" style="margin: 0">
			Harga terkunci saat pesanan dibuat. Ongkir dicatat terpisah dan tidak mengubah total (BA-06).
		</p>
	</div>

	<!-- Pembeli & pengiriman (AD-06, AD-08) -->
	<div class="surface">
		<h3 style="margin-top: 0">Pembeli &amp; pengiriman</h3>
		<div class="row">
			<div class="row-main">
				<div class="row-l1">{order.customerName} · <span class="tabular">{order.customerPhone}</span></div>
				<div class="row-l2">
					{#if order.email}Email: {order.email}<br />{/if}
					{order.address}, {order.city}<br />
					{#if order.note}Catatan pembeli: {order.note}<br />{/if}
					Tanggal kirim: {formatDateId(order.deliveryDate)} · kurir pilihan: {order.courier}
				</div>
			</div>
		</div>
		<p class="muted tabular" style="margin: 0.5rem 0 0">Titik peta: {order.lat}, {order.lng}</p>
		<div class="btn-row">
			<button class="btn-mini" type="button" onclick={() => copyText(`${order.address}, ${order.city}`, 'Alamat')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/></svg>
				Salin alamat
			</button>
			<button class="btn-mini" type="button" onclick={() => copyText(`${order.lat}, ${order.lng}`, 'Koordinat')}>
				Salin koordinat
			</button>
			<a class="btn-mini is-rust" href={mapsLink} target="_blank" rel="noreferrer">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
				Buka di Google Maps
			</a>
		</div>
	</div>

	<!-- Ongkir (AD-09, BA-06) -->
	<div class="surface">
		<h3 style="margin-top: 0">Ongkir</h3>
		<div class="stepchain" aria-label="Status ongkir">
			{#each shippingSteps as step, i (step.key)}
				<span class="step" class:is-done={i < shippingIndex} class:is-current={i === shippingIndex}>
					<svg class="mk" viewBox="0 0 12 12" aria-hidden="true">
						{#if i <= shippingIndex}<circle cx="6" cy="6" r="5" fill="currentColor" />{:else}<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="2" />{/if}
					</svg>
					{step.label}
				</span>
				{#if i < shippingSteps.length - 1}<span class="sep">›</span>{/if}
			{/each}
		</div>
		<form method="POST" action="?/ongkir" use:enhance={adminEnhance()}>
			<div class="field">
				<label for="nominal">Nominal ongkir dari aplikasi kurir</label>
				<input id="nominal" name="nominal" type="text" inputmode="numeric" value={order.shippingActualIdr ?? ''} placeholder="mis. 25000" />
				<p class="hint">Dicatat terpisah, tidak mengubah total pesanan.</p>
			</div>
			<div class="btn-row">
				{#if order.shippingStatus === 'not_booked'}
					<button class="btn-mini" type="submit" name="courier_booked" value="1">Catat kurir dipesan</button>
				{/if}
				{#if shippingIndex > 0}
					<button class="btn-mini" type="submit" name="shipping_status" value="not_booked">Kembali: belum dipesan</button>
				{/if}
				{#if shippingIndex < 2 && shippingIndex >= 0}
					<button class="btn-mini is-rust" type="submit" name="shipping_status" value="billed">Tandai ditagih</button>
				{/if}
				{#if shippingIndex < 3 && shippingIndex >= 0}
					<button class="btn-mini is-rust" type="submit" name="shipping_status" value="paid">Tandai lunas</button>
				{/if}
				<button class="btn-mini" type="submit" name="shipping_status" value={order.shippingStatus}>Simpan nominal</button>
			</div>
		</form>
	</div>

	<!-- WhatsApp (AD-10) -->
	<div class="surface">
		<h3 style="margin-top: 0">WhatsApp ke pembeli</h3>
		<p class="muted" style="margin-bottom: 0.5rem">
			Templat terisi kode pesanan, nama, dan nominal — dikirim ke {order.customerPhone}.
		</p>
		<div class="btn-row">
			<a class="btn-mini" href={waLink('konfirmasi')} target="_blank" rel="noreferrer">Konfirmasi pesanan</a>
			<a class="btn-mini is-rust" href={waLink('tagih_ongkir')} target="_blank" rel="noreferrer">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.2-3.6-.8-3-1.3-5-4.5-5.2-4.7-.1-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l1-1.1c.2-.2.4-.2.6-.1l2.1 1c.3.1.5.2.5.4.1.1.1.6-.1 1.4z"/></svg>
				Tagih ongkir
			</a>
			<a class="btn-mini" href={waLink('pindah_tanggal')} target="_blank" rel="noreferrer">Pindah tanggal</a>
		</div>
	</div>

	<!-- Pembayaran DOKU (AD-12) -->
	<div class="surface">
		<h3 style="margin-top: 0">Pembayaran DOKU</h3>
		<p class="muted tabular" style="margin-bottom: 0.5rem">
			Invoice {order.code} · dibayar {order.paidAt ? formatDateTimeId(order.paidAt) : '—'}
			{#if order.manualPaidReason}· manual: {order.manualPaidReason}{/if}
		</p>
		<form method="POST" action="?/cek_doku" use:enhance={adminEnhance()}>
			<div class="btn-row">
				<button class="btn-mini" type="submit">Cek status ke DOKU</button>
			</div>
		</form>
		{#if order.status === 'pending_payment'}
			<form
				method="POST"
				action="?/bayar_manual"
				use:enhance={adminEnhance()}
				onsubmit={(event) => {
					if (!window.confirm('Tandai bayar manual? Pastikan sudah memeriksa dashboard DOKU. Tindakan tercatat di log audit.')) {
						event.preventDefault();
					}
				}}
			>
				<div class="field">
					<label for="alasan-bayar">Alasan penandaan manual (wajib)</label>
					<input id="alasan-bayar" name="reason" type="text" placeholder="mis. transfer diterima, terlihat di dashboard DOKU" required />
				</div>
				<button class="btn-mini is-danger" type="submit">Tandai bayar manual…</button>
			</form>
		{/if}
	</div>

	<!-- Catatan internal (AD-11) -->
	<div class="surface">
		<h3 style="margin-top: 0">Catatan internal</h3>
		<form method="POST" action="?/catatan" use:enhance={adminEnhance()}>
			<div class="field">
				<label for="catatan" class="visually-hidden" style="position: absolute; left: -9999px">Catatan internal</label>
				<textarea id="catatan" name="note" placeholder="Tulis catatan untuk diri sendiri…">{order.internalNote ?? ''}</textarea>
				<p class="hint">Tidak pernah tampil ke pembeli.</p>
			</div>
			<button class="btn-mini" type="submit">Simpan catatan</button>
		</form>
	</div>

	<!-- Pengembalian dana (BA-04) -->
	{#if order.status === 'cancelled' || order.refundNote}
		<div class="surface">
			<h3 style="margin-top: 0">Pengembalian dana</h3>
			{#if order.refundNote}
				<p class="info-box">
					Tercatat {order.refundNotedAt ? formatDateTimeId(order.refundNotedAt) : ''} — {order.refundNote}
				</p>
			{/if}
			<form method="POST" action="?/refund" use:enhance={adminEnhance()}>
				<div class="field">
					<label for="catatan-refund">Catatan pengembalian (dilakukan di dashboard DOKU)</label>
					<input id="catatan-refund" name="note" type="text" placeholder="mis. dana dikembalikan via transfer, 20 Nov" required />
				</div>
				<button class="btn-mini" type="submit">Catat pengembalian</button>
			</form>
		</div>
	{/if}

	<!-- Riwayat (AD-06, BA-12) -->
	<div class="section-head">
		<h2>Riwayat</h2>
	</div>
	<div class="surface">
		{#if order.history.length === 0}
			<p class="muted" style="margin: 0">Belum ada perubahan tercatat untuk pesanan ini.</p>
		{:else}
			<ul class="timeline">
				{#each order.history as entry (entry.id)}
					<li>
						<span class="when">{formatDateTimeId(entry.createdAt)} · {entry.actor === 'sistem' ? 'sistem' : entry.actor}</span>
						{actionLabel[entry.action] ?? entry.action}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Aksi berisiko (BA-03, BA-07) -->
	<div class="section-head">
		<h2>Aksi lain</h2>
	</div>
	<div class="surface">
		<form method="POST" action="?/tanggal" use:enhance={adminEnhance()}>
			<h3 style="margin-top: 0">Pindah tanggal kirim</h3>
			<p class="muted">Hanya Sabtu atau Minggu (BA-07). Pembeli perlu diberi tahu lewat WhatsApp.</p>
			<div class="field">
				<label for="tanggal-baru">Tanggal kirim baru</label>
				<input id="tanggal-baru" name="date" type="date" required />
			</div>
			<div class="field">
				<label for="alasan-tanggal">Catatan pemindahan (wajib)</label>
				<input id="alasan-tanggal" name="note" type="text" placeholder="mis. permintaan pembeli" required />
			</div>
			<button class="btn-mini" type="submit">Pindahkan tanggal</button>
		</form>

		<hr class="divider" />

		{#if order.status === 'paid' || order.status === 'packed'}
			<form
				method="POST"
				action="?/status"
				use:enhance={adminEnhance('Status pesanan diperbarui.')}
				onsubmit={(event) => {
					if (!window.confirm(`Batalkan pesanan ${order.code}? Tindakan tercatat di log audit.`)) {
						event.preventDefault();
					}
				}}
			>
				<h3 style="margin-top: 0">Batalkan pesanan</h3>
				<p class="muted">Hanya dari status Dibayar atau Dikemas; alasan wajib (BA-03).</p>
				<input type="hidden" name="to" value="cancelled" />
				<div class="field">
					<label for="alasan-batal">Alasan pembatalan</label>
					<input id="alasan-batal" name="reason" type="text" placeholder="mis. pembeli membatalkan lewat WhatsApp" required />
				</div>
				<label style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.9375rem; margin-bottom: 0.75rem">
					<input type="checkbox" name="restore_stock" value="1" checked style="width: 20px; height: 20px; min-height: 0" />
					Stok dikembalikan
				</label>
				<button class="btn-mini is-danger" type="submit">Ya, batalkan pesanan</button>
			</form>
		{:else if order.status === 'pending_payment'}
			<p class="muted" style="margin: 0">
				Pesanan menunggu bayar tidak dibatalkan admin (BA-02) — sistem yang menandai
				kedaluwarsa saat batas waktu lewat.
			</p>
		{:else}
			<p class="muted" style="margin: 0">
				{order.status === 'shipped'
					? 'Pesanan yang sudah dikirim tidak bisa dibatalkan (BA-05) — komplain dicatat di catatan internal.'
					: 'Status akhir — tidak ada aksi pembatalan.'}
			</p>
		{/if}
	</div>
</main>

{#if printing}
	<div class="print-area">
		<section class="print-sheet">
			<h2 class="print-title">KURMAPLUS — Pesanan {order.code} — {formatDateId(order.deliveryDate)}</h2>
			<p style="margin: 0.25rem 0 0.75rem">Tanggal pesanan: {formatDateTimeId(order.createdAt)}</p>
			<div class="surface">
				<h3 style="margin-top: 0">Isi pesanan · {order.items.length} jenis · {kemasanCount} kemasan</h3>
				{#each order.items as item}
					<div class="row">
						<div class="row-main">
							<div class="row-l1">{item.name}</div>
							<div class="row-l2 tabular">{item.qty} × {formatRupiah(item.priceIdr)}</div>
						</div>
						<div class="row-side tabular">{formatRupiah(item.priceIdr * item.qty)}</div>
					</div>
				{/each}
				<hr class="divider" />
				<div class="row">
					<div class="row-main"><strong>Total pesanan</strong></div>
					<div class="row-side tabular"><strong>{formatRupiah(order.totalIdr)}</strong></div>
				</div>
				<hr class="divider" />
				<div class="row">
					<div class="row-main">
						<div class="row-l1">Pemesan</div>
						<div class="row-l2 tabular">
							{order.customerName}<br />
							{order.customerPhone}{#if order.email} · {order.email}{/if}
						</div>
					</div>
				</div>
				<hr class="divider" />
				<div class="row">
					<div class="row-main">
						<div class="row-l1">Pengiriman</div>
						<div class="row-l2 tabular">
							{order.address}, {order.city}<br />
							{formatDateId(order.deliveryDate)} · kurir {order.courier}
							{#if order.note}<br />Catatan: {order.note}{/if}
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
{/if}

{#if forward[order.status] ?? backward[order.status]}
	<div class="admin-sticky no-print">
		<div class="wrap" style="padding: 0">
			{#if forward[order.status]}
				<form
					method="POST"
					action="?/status"
					use:enhance={adminEnhance('Status pesanan diperbarui.')}
					onsubmit={(event) => {
						if (!window.confirm(`${forwardLabel[forward[order.status] ?? '']}? Perpindahan status tercatat di log audit.`)) {
							event.preventDefault();
						}
					}}
				>
					<input type="hidden" name="to" value={forward[order.status]} />
					<button class="btn" type="submit">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
						{forwardLabel[forward[order.status] ?? '']}
					</button>
				</form>
			{/if}
			{#if backward[order.status]}
				<form
					method="POST"
					action="?/status"
					use:enhance={adminEnhance('Status pesanan diperbarui.')}
					onsubmit={(event) => {
						const reason = window.prompt('Koreksi mundur satu langkah — alasan (wajib):');
						if (reason === null || reason.trim() === '') {
							event.preventDefault();
							return;
						}
						const hidden = document.createElement('input');
						hidden.type = 'hidden';
						hidden.name = 'reason';
						hidden.value = reason;
						event.currentTarget.appendChild(hidden);
					}}
				>
					<input type="hidden" name="to" value={backward[order.status]} />
					<button class="btn btn-secondary" type="submit" style="margin-top: 0.5rem">Koreksi mundur satu langkah…</button>
				</form>
			{/if}
			<p class="sticky-hint">Perpindahan status tercatat di log audit</p>
		</div>
	</div>
{/if}

<div class="page-foot-space"></div>
