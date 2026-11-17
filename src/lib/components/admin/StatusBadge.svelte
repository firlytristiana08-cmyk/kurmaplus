<script lang="ts">
	// Lencana status pesanan — teks + bentuk penanda; warna hanya penguat
	// (PRD Portal Admin: status terbaca tanpa warna).
	import type { OrderStatus } from '#lib/order-status';
	import { STATUS_LABEL_ID } from '#lib/order-status';

	let { status }: { status: OrderStatus } = $props();

	const badgeClass: Record<OrderStatus, string> = {
		pending_payment: 'badge-wait',
		paid: 'badge-ok',
		packed: 'badge-ok',
		shipped: 'badge-wait',
		done: 'badge-ok',
		expired: 'badge-off',
		cancelled: 'badge-alert',
	};
</script>

{#snippet mark(status: OrderStatus)}
	{#if status === 'pending_payment'}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
	{:else if status === 'paid'}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor"/></svg>
	{:else if status === 'packed'}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="currentColor"/></svg>
	{:else if status === 'shipped'}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 11.5 10.5H0.5z" fill="currentColor"/></svg>
	{:else if status === 'done'}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0.5 7.6 4l3.9.4-2.9 2.6.8 3.8L6 8.9 2.6 10.8l.8-3.8L0.5 4.4 4.4 4z" fill="currentColor"/></svg>
	{:else if status === 'expired'}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0.5 11.5 6 6 11.5 0.5 6z" fill="currentColor"/></svg>
	{:else}
		<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="M0.5 0.5 11.5 11.5M11.5 0.5 0.5 11.5" stroke="currentColor" stroke-width="2.4"/></svg>
	{/if}
{/snippet}

<span class="badge {badgeClass[status]}">
	{@render mark(status)}
	{STATUS_LABEL_ID[status]}
</span>
