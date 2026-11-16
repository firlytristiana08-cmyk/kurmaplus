<script lang="ts">
	import Wordmark from './Wordmark.svelte';
</script>

<header class="header">
	<div class="header-inner">
		<Wordmark href="/katalog" />
		<nav aria-label="Navigasi utama">
			<a href="/lacak">Lacak pesanan</a>
		</nav>
	</div>
</header>

<style>
	.header {
		border-bottom: 1px solid var(--sand);
		background: var(--paper);
	}

	.header-inner {
		max-width: 430px;
		margin: 0 auto;
		padding: 14px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.header a {
		color: var(--ink);
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
		min-height: 48px;
		display: inline-flex;
		align-items: center;
	}

	.header a:hover {
		text-decoration: underline;
	}
</style>
