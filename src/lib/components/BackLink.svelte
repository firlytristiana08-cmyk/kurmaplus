<script lang="ts">
	// Tombol teks "Kembali" dengan ikon di awal, berada di luar navbar.
	// `href` = tujuan cadangan bila tidak ada riwayat peramban (mis. halaman anak admin).
	let { href = '/' }: { href?: string } = $props();
	function goBack(event: MouseEvent): void {
		if (window.history.length > 1) {
			event.preventDefault();
			window.history.back();
		}
	}
</script>

<div class="back-bar">
	<a class="back-link" {href} onclick={goBack}>
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path
				d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
			/>
		</svg>
		Kembali
	</a>
</div>

<style>
	.back-bar {
		max-width: 430px;
		margin: 0 auto;
		padding: 10px 16px 0;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 48px;
		color: var(--ink);
		font-size: 0.9375rem;
		font-weight: 700;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	svg {
		display: block;
		flex: none;
	}
</style>
