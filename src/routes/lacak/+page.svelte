<script lang="ts">
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { clearInvalid, handleInvalid } from '#lib/validation';

	let { form }: { form?: { message?: string } } = $props();

	let codeValue = $state('');
	let phoneValue = $state('');

	// Pintasan data demo — hanya tampil di server dev (tidak ikut build produksi).
	const DEMO_TRACKING = [
		{ code: 'DEMO2233', tail: '7890' },
		{ code: 'DEMO4455', tail: '5432' },
		{ code: 'DEMO6677', tail: '9900' },
		{ code: 'DEMO8822', tail: '7788' },
		{ code: 'DEMO3344', tail: '2211' },
		{ code: 'DEMO7788', tail: '4433' },
		{ code: 'DEMO5599', tail: '3344' }
	];

	function fillDemo(code: string, tail: string): void {
		codeValue = code;
		phoneValue = tail;
	}
</script>

<svelte:head>
	<title>Lacak pesanan — KURMAPLUS</title>
	<meta name="description" content="Cek status pesanan dengan kode pesanan dan 4 digit terakhir WhatsApp." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<h1>Lacak pesanan</h1>
	<p class="muted">
		Masukkan kode pesanan (8 karakter) dan 4 digit terakhir nomor WhatsApp yang dipakai saat
		checkout.
	</p>

	{#if form?.message}
		<div class="error-box" role="alert">{form.message}</div>
	{/if}

	<form method="POST" oninvalidcapture={handleInvalid} oninputcapture={clearInvalid}>
		<div class="field">
			<label for="code">Kode pesanan/No Invoice <span class="required-mark">*</span></label>
			<input
				id="code"
				name="code"
				type="text"
				required
				minlength="8"
				maxlength="8"
				autocomplete="off"
				placeholder="mis. DEMO2233"
				data-validation-message="Kode pesanan terdiri dari 8 karakter (huruf besar dan angka 2-9)."
				bind:value={codeValue}
				oninput={(event) => {
					event.currentTarget.value = event.currentTarget.value
						.toUpperCase()
						.replace(/[^A-Z0-9]/g, '');
				}}
			/>
		</div>
		<div class="field">
			<label for="phoneTail">4 digit terakhir WhatsApp <span class="required-mark">*</span></label>
			<input
				id="phoneTail"
				name="phoneTail"
				type="text"
				inputmode="numeric"
				pattern={'[0-9]{4,15}'}
				maxlength="15"
				required
				placeholder="mis. 7890"
				data-validation-message="Isi 4 digit terakhir nomor WhatsApp (boleh nomor penuh — 4 digit terakhirnya otomatis dipakai)."
				bind:value={phoneValue}
				oninput={(event) => {
					event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '');
				}}
			/>
		</div>
		<button type="submit" class="btn">Lihat status pesanan</button>
	</form>

	{#if import.meta.env.DEV}
		<div class="demo-fill">
			<p class="muted">Data demo — ketuk untuk mengisi otomatis:</p>
			<div class="demo-chips">
				{#each DEMO_TRACKING as demo (demo.code)}
					<button type="button" class="demo-chip" onclick={() => fillDemo(demo.code, demo.tail)}>
						{demo.code} · {demo.tail}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</main>

<style>
	.demo-fill {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--sand);
	}

	.demo-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.demo-chip {
		min-height: 48px;
		padding: 0 0.875rem;
		border: 1.5px solid var(--sand);
		border-radius: var(--radius-s);
		background: var(--card);
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--ink);
		cursor: pointer;
	}

	.demo-chip:hover {
		border-color: var(--brick);
	}
</style>

<PageFooter />
