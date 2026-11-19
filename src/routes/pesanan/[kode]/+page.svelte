<script lang="ts">
	import { clearDirectBuy } from '#lib/cart.svelte';
	import { formatDateId, formatDateTimeId, formatRupiah } from '#lib/format';
	import { STATUS_LABEL_ID, type OrderStatus } from '#lib/order-status';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import ProsesLoader from '#lib/components/ProsesLoader.svelte';
	import type { OrderPageData } from './+page.server';

	let { data }: { data: OrderPageData } = $props();

	const order = $derived(data.order);
	const isPending = $derived(order.status === 'pending_payment');

	$effect(() => {
		// Pesanan berhasil dibuat / dilihat: sesi beli langsung tidak dipakai lagi.
		clearDirectBuy();
	});
	const statusLabel = $derived(STATUS_LABEL_ID[order.status]);
	const badgeClass = $derived(
		order.status === 'paid' || order.status === 'done'
			? 'badge-ok'
			: isPending
				? 'badge-wait'
				: order.status === 'expired' || order.status === 'cancelled'
					? 'badge-alert'
					: 'badge-off'
	);

	// Penanda bentuk (PRD desain: status = teks + bentuk, warna hanya penguat).
	const STATUS_MARK: Record<OrderStatus, string> = {
		pending_payment: '○',
		paid: '●',
		packed: '■',
		shipped: '▲',
		done: '★',
		expired: '◇',
		cancelled: '✕',
	};

	const modalText = $derived(
		order.status === 'paid' || order.status === 'done'
			? 'Pembayaran Anda sudah kami terima. Terima kasih!'
			: isPending
				? 'Pesanan ini belum dibayar. Selesaikan pembayaran lewat halaman bayar DOKU.'
				: order.status === 'expired'
					? 'Batas waktu pembayaran berakhir. Silakan buat pesanan baru bila masih ingin memesan.'
					: order.status === 'cancelled'
						? 'Pesanan ini dibatalkan. Hubungi kami lewat WhatsApp bila ada yang ingin ditanyakan.'
						: order.status === 'packed'
							? 'Pesanan sedang dikemas dan akan segera dikirim.'
							: 'Pesanan sedang dalam perjalanan ke alamat Anda.'
	);

	const modalTitle = $derived(
		order.status === 'paid' || order.status === 'done'
			? 'Terbayar'
			: isPending
				? 'Menunggu pembayaran'
				: order.status === 'expired'
					? 'Batas waktu berakhir'
					: order.status === 'cancelled'
						? 'Pesanan dibatalkan'
						: order.status === 'packed'
							? 'Sedang dikemas'
							: 'Sedang dikirim'
	);

	const whatsappText = $derived(
		encodeURIComponent(
			`Halo KURMAPLUS, saya ${order.customerName} ingin menanyakan pesanan ${order.code}.`
		)
	);
	const whatsappUrl = $derived(`https://wa.me/${data.whatsappOwner}?text=${whatsappText}`);

	let loading = $state(false);
	let showModal = $state(false);
	// svelte-ignore state_referenced_locally -- modal status tampil sekali saat render pertama.
	if (data.showStatusModal) {
		showModal = true;
	}

	function closeModal(): void {
		showModal = false;
	}
</script>

<svelte:head>
	<title>Pesanan {order.code} — KURMAPLUS</title>
	<meta name="description" content="Status pesanan KURMAPLUS Anda." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<section class="status-head">
		<h1>Pesanan {order.code}</h1>
		<p class={`badge ${badgeClass}`}>{statusLabel}</p>
		<p class="muted">Dibuat {formatDateTimeId(order.createdAt)}</p>

		{#if isPending}
			<div class="info-box">
				Batas waktu bayar {data.paymentDueMinutes} menit sejak pesanan dibuat. Lewat dari itu,
				pesanan otomatis kedaluwarsa dan stok kembali tersedia.
			</div>
			{#if order.checkoutUrl}
				<a class="btn" href={order.checkoutUrl}>Lanjutkan pembayaran</a>
			{:else if data.previewPayment}
				<form method="POST" action="?/simulasi" onsubmit={() => (loading = true)}>
					<button type="submit" class="btn">Simulasikan pembayaran (pratinjau)</button>
				</form>
				<p class="hint">
					Pratinjau tanpa kunci DOKU: tombol ini menandai pesanan lunas lewat jalur yang sama
					dengan notifikasi pembayaran sungguhan.
				</p>
			{:else}
				<form method="POST" action="?/bayar" onsubmit={() => (loading = true)}>
					<button type="submit" class="btn">Buat halaman bayar baru</button>
				</form>
			{/if}
		{/if}
	</section>

	<section class="surface" aria-labelledby="isi-heading">
		<h2 id="isi-heading">Isi pesanan</h2>
		<ul class="item-list">
			{#each order.items as item (item.name)}
				<li>
					<span>{item.name} × {item.qty}</span>
					<span class="tabular">{formatRupiah(item.priceIdr * item.qty)}</span>
				</li>
			{/each}
		</ul>
		<hr class="divider" />
		<div class="total-row">
			<span>Total (tanpa ongkir)</span>
			<strong class="tabular">{formatRupiah(order.totalIdr)}</strong>
		</div>
	</section>

	<section class="surface" aria-labelledby="kirim-heading">
		<h2 id="kirim-heading">Detail pengiriman</h2>
		<dl class="detail-list">
			<div>
				<dt>Penerima</dt>
				<dd>{order.customerName}</dd>
			</div>
			<div>
				<dt>Nomor WhatsApp</dt>
				<dd>{order.customerPhone}</dd>
			</div>
			{#if order.email}
				<div>
					<dt>Email</dt>
					<dd>{order.email}</dd>
				</div>
			{/if}
			<div>
				<dt>Alamat</dt>
				<dd>{order.address}</dd>
			</div>
			<div>
				<dt>Kota</dt>
				<dd>{order.city}</dd>
			</div>
			<div>
				<dt>Kurir</dt>
				<dd>{order.courier}</dd>
			</div>
			<div>
				<dt>Tanggal kirim</dt>
				<dd>{formatDateId(order.deliveryDate)}</dd>
			</div>
			{#if order.note}
				<div>
					<dt>Catatan</dt>
					<dd>{order.note}</dd>
				</div>
			{/if}
		</dl>
		<div class="info-box">
			Ongkir {order.courier} dibayar pemesan saat kurir datang, tidak termasuk total pesanan ini.
		</div>
	</section>

	<a class="btn btn-secondary" href={whatsappUrl} target="_blank" rel="noopener">
		<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path
				d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.1 14.8l-.4-.2-2.6.7.7-2.5-.2-.4A8 8 0 0 1 12 4Zm-3.2 4c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 2 0 1.2.8 2.3.9 2.5.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.6 2.7.6.4 0 1.3-.5 1.5-1.1.2-.6.2-1 .1-1.1-.1-.1-.3-.2-.6-.4l-1.4-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.4c0-.2-.5-1.4-.7-1.9-.2-.5-.4-.4-.6-.4h-.6Z"
			/>
		</svg>
		Chat WhatsApp KURMAPLUS
	</a>
	<p class="hint">Pesan otomatis berisi kode pesanan {order.code} dan nama Anda.</p>
</main>

<PageFooter />

{#if showModal}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={closeModal}
		onkeydown={(event) => event.key === 'Escape' && closeModal()}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-status-title"
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeModal()}
		>
			<span class={`modal-mark ${badgeClass}`} aria-hidden="true">{STATUS_MARK[order.status]}</span>
			<h2 id="modal-status-title">{modalTitle}</h2>
			<p class={`badge ${badgeClass}`}>{statusLabel}</p>
			<p class="modal-text">{modalText}</p>
			{#if isPending}
				<p class="hint">
					Baru saja membayar? Status bisa membutuhkan beberapa saat — ketuk “Perbarui status”.
				</p>
			{/if}
			<div class="modal-actions">
				{#if isPending}
					<button class="btn btn-secondary" type="button" onclick={() => window.location.reload()}>
						Perbarui status
					</button>
				{/if}
				<button class="btn" type="button" onclick={closeModal}>
					{isPending ? 'Tutup' : 'Mengerti'}
				</button>
			</div>
		</div>
	</div>
{/if}

<ProsesLoader show={loading} />

<style>
	.status-head {
		padding: 1.25rem 0 1.25rem;
	}

	.status-head .info-box {
		margin-bottom: 1rem;
	}

	.status-head .hint {
		margin-top: 0.625rem;
	}

	.surface {
		margin-bottom: 1rem;
	}

	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.item-list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.375rem 0;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 1.0625rem;
	}

	.detail-list {
		margin: 0 0 0.875rem;
	}

	.detail-list div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.25rem 0;
	}

	dt {
		color: #797284;
		color: color-mix(in srgb, var(--ink) 62%, var(--paper));
	}

	dd {
		margin: 0;
		font-weight: 700;
		text-align: right;
	}

	.btn-icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	a.btn {
		margin-top: 0.25rem;
	}

	.hint {
		font-size: 0.8125rem;
		color: #797284;
		color: color-mix(in srgb, var(--ink) 62%, var(--paper));
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(45, 38, 75, 0.45);
		background: color-mix(in srgb, var(--ink) 45%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		z-index: 50;
	}

	.modal {
		background: var(--paper);
		border: 1px solid #d0c9c5;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, var(--paper));
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 22rem;
		width: 100%;
		text-align: center;
	}

	.modal-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		font-size: 1.5rem;
		border: 2px solid currentColor;
		margin-bottom: 0.625rem;
	}

	.modal-mark.badge-ok {
		color: var(--rust);
	}

	.modal-mark.badge-wait {
		color: #696278;
		color: color-mix(in srgb, var(--ink) 70%, var(--paper));
	}

	.modal-mark.badge-alert {
		color: var(--rust-press);
	}

	.modal h2 {
		margin: 0 0 0.375rem;
		font-size: 1.25rem;
	}

	.modal-text {
		margin: 0.625rem 0 0;
	}

	.modal-actions {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 1.125rem;
	}
</style>
