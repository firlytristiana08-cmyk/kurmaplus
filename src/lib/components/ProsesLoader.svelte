<script lang="ts">
	// Overlay proses pembayaran: tampil saat formulir dikirim ke server
	// (pembuatan halaman bayar DOKU membutuhkan beberapa saat).
	let { show, label = 'Sedang menyiapkan halaman bayar…' }: { show: boolean; label?: string } =
		$props();
</script>

{#if show}
	<div class="loader-overlay" role="status" aria-live="polite">
		<div class="loader-panel">
			<span class="loader-ring" aria-hidden="true"></span>
			<p>{label}</p>
		</div>
	</div>
{/if}

<style>
	.loader-overlay {
		position: fixed;
		inset: 0;
		background: rgba(45, 38, 75, 0.45);
		background: color-mix(in srgb, var(--ink) 45%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 60;
		padding: 1.5rem;
	}

	.loader-panel {
		background: var(--paper);
		border: 1px solid #d0c9c5;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, var(--paper));
		border-radius: 12px;
		padding: 1.5rem 1.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		max-width: 20rem;
		text-align: center;
	}

	.loader-panel p {
		margin: 0;
		font-weight: 700;
	}

	.loader-ring {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		border: 3px solid rgba(171, 55, 16, 0.25);
		border: 3px solid color-mix(in srgb, var(--rust) 25%, transparent);
		border-top-color: var(--rust);
		animation: putar 0.8s linear infinite;
	}

	@keyframes putar {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loader-ring {
			animation-duration: 2.4s;
		}
	}
</style>
