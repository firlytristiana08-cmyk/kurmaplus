<script lang="ts">
	// Gerbang masuk pemilik (PRD Portal Admin — Autentikasi).
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const needsMfa = $derived(form?.needsMfa === true);
</script>

<svelte:head>
	<title>Masuk · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head">
		<p class="wordmark">KURMAPLUS <span class="plus">Admin</span></p>
		<h1>Masuk</h1>
		<p class="muted page-sub">Khusus pemilik toko. Data pelanggan tidak tampil di sini tanpa masuk.</p>
	</header>

	{#if form?.message}
		<p class="error-box">{form.message}</p>
	{/if}

	{#if data.session}
		<div class="surface">
			<p style="margin: 0 0 0.75rem">
				Anda sudah masuk sebagai <strong>{data.session.label}</strong>.
			</p>
			<form method="POST" action="?/keluar" use:enhance>
				<button class="btn btn-secondary" type="submit">Keluar</button>
			</form>
		</div>
	{:else if data.isDev}
		<div class="surface">
			<p class="info-box" style="margin-top: 0">
				Mode pengembangan — masuk memakai sesi demo pemilik. Login Supabase Auth (email,
				password, kode authenticator) aktif di produksi.
			</p>
			<form method="POST" action="?/demo" use:enhance>
				<button class="btn" type="submit">Masuk sebagai pemilik (demo)</button>
			</form>
		</div>
	{:else}
		<form class="surface" method="POST" action="?/masuk" use:enhance>
			{#if needsMfa}
				<p class="info-box">Masukkan kode 6 digit dari aplikasi authenticator Anda.</p>
				<div class="field">
					<label for="totp">Kode authenticator</label>
					<input id="totp" name="totp" type="text" inputmode="numeric" autocomplete="one-time-code" required />
				</div>
			{:else}
				<div class="field">
					<label for="email">Email</label>
					<input id="email" name="email" type="email" autocomplete="username" required />
				</div>
				<div class="field">
					<label for="password">Password</label>
					<input id="password" name="password" type="password" autocomplete="current-password" required />
				</div>
			{/if}
			<button class="btn" type="submit">{needsMfa ? 'Verifikasi kode' : 'Masuk'}</button>
		</form>
	{/if}
</main>

<div class="page-foot-space"></div>
