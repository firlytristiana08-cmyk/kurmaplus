<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	// Log transaksi pembayaran (DOKU) per pesanan — hanya bisa dibaca.
	import { formatDateTimeId, formatRupiah } from '#lib/format';
	import { STATUS_LABEL_ID, type OrderStatus } from '#lib/order-status';

	let { data } = $props();
	const filter = $derived(data.filter);

	const STATUS_MARK: Record<OrderStatus, string> = {
		pending_payment: '○',
		paid: '●',
		packed: '■',
		shipped: '▲',
		done: '★',
		expired: '◇',
		cancelled: '✕',
	};

	function orderBadgeClass(status: string): string {
		if (status === 'paid' || status === 'done' || status === 'packed') return 'badge-ok';
		if (status === 'pending_payment' || status === 'shipped') return 'badge-wait';
		return 'badge-alert';
	}

	function pageUrl(status: string | null): string {
		return status === null || status === '' ? '/admin/transaksi' : `/admin/transaksi?status=${status}`;
	}
</script>

<svelte:head>
	<title>Log transaksi · KURMAPLUS Admin</title>
</svelte:head>

<BackLink href="/admin/lainnya" />

<main class="wrap">
	<header class="admin-head">
		<h1>Log transaksi</h1>
		<p class="muted page-sub">
			Riwayat pembayaran DOKU per pesanan. Hanya-baca — tidak bisa diubah atau dihapus.
		</p>
	</header>

	<div class="chip-row">
		<a class="chip" class:is-active={filter === ''} href={pageUrl(null)}>Semua</a>
		<a class="chip" class:is-active={filter === 'pending'} href={pageUrl('pending')}>Menunggu</a>
		<a class="chip" class:is-active={filter === 'success'} href={pageUrl('success')}>Sukses</a>
	</div>

	<div class="surface">
		{#if data.rows.length === 0}
			<p class="muted">Belum ada transaksi pada saringan ini.</p>
		{:else}
			{#each data.rows as row (row.invoiceNumber + row.createdAt)}
				<div class="row">
					<div class="row-main">
						<div class="row-l1">
							<a href={`/admin/pesanan/${row.orderCode}`}>{row.orderCode}</a>
							<span class="tabular">{formatRupiah(row.totalIdr)}</span>
						</div>
						<div class="row-l2">
							{formatDateTimeId(row.createdAt)} · {row.customerName}
						</div>
						<div class="row-l2">
							<span class={`badge ${row.paymentStatus === 'success' ? 'badge-ok' : 'badge-wait'}`}>
								{row.paymentStatus === 'success' ? '●' : '○'}
								Bayar {row.paymentStatus === 'success' ? 'sukses' : 'menunggu'}
							</span>
							<span class={`badge ${orderBadgeClass(row.orderStatus)}`}>
								{STATUS_MARK[row.orderStatus as OrderStatus] ?? '○'}
								{STATUS_LABEL_ID[row.orderStatus as OrderStatus] ?? row.orderStatus}
							</span>
						</div>
					</div>
					<div class="row-side">
						{#if row.checkoutUrl}
							<a href={row.checkoutUrl} target="_blank" rel="noopener">Halaman bayar ↗</a>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</main>

<div class="page-foot-space"></div>
