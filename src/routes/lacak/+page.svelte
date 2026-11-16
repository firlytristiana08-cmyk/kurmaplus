<script lang="ts">
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';

	let { form }: { form?: { message?: string } } = $props();
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

	<form method="POST">
		<div class="field">
			<label for="code">Kode pesanan <span class="required-mark">*</span></label>
			<input
				id="code"
				name="code"
				type="text"
				required
				minlength="8"
				maxlength="8"
				autocomplete="off"
				style="text-transform: uppercase"
			/>
		</div>
		<div class="field">
			<label for="phoneTail">4 digit terakhir WhatsApp <span class="required-mark">*</span></label>
			<input
				id="phoneTail"
				name="phoneTail"
				type="text"
				inputmode="numeric"
				pattern="[0-9]{4}"
				maxlength="4"
				required
			/>
		</div>
		<button type="submit" class="btn">Lihat status pesanan</button>
	</form>
</main>

<PageFooter />
