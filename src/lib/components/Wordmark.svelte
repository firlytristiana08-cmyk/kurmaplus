<script lang="ts">
	let {
		href = '/',
		level = 'span'
	}: {
		href?: string;
		level?: 'span' | 'h1';
	} = $props();
</script>

{#if level === 'h1'}
	<h1 class="wordmark"><a {href}>KURMA<span class="plus">PLUS</span></a></h1>
{:else}
	<span class="wordmark"><a {href}>KURMA<span class="plus">PLUS</span></a></span>
{/if}

<style>
	.wordmark {
		margin: 0;
		font-family: 'Figtree', system-ui, sans-serif;
		font-weight: 800;
		font-size: 1.125rem;
		letter-spacing: -0.01em;
		line-height: 1.15;
	}

	h1.wordmark {
		font-family: 'Figtree', system-ui, sans-serif;
		font-weight: 800;
		font-size: 1.375rem;
	}

	.wordmark a {
		color: var(--ink);
		text-decoration: none;
	}

	.plus {
		color: var(--rust);
	}
</style>
