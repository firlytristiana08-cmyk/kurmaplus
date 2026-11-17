<script lang="ts">
	// Gerbang masuk pemilik (PRD Portal Admin — Autentikasi, tanpa MFA).

	interface MasukForm {
		message?: string;
	}

	let { data, form }: { data: import('./$types').PageData; form?: MasukForm } = $props();
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
			<form method="POST" action="?/keluar">
				<button class="btn btn-secondary" type="submit">Keluar</button>
			</form>
		</div>
	{:else if data.isDev}
		<div class="surface">
			<p class="info-box" style="margin-top: 0">
				Mode pengembangan — masuk memakai sesi demo pemilik. Login Supabase Auth (email dan
				password) aktif di produksi.
			</p>
			<form method="POST" action="?/demo">
				<button class="btn" type="submit">Masuk sebagai pemilik (demo)</button>
			</form>
		</div>
	{:else}
		<form class="surface" method="POST" action="?/masuk">
			<div class="field">
				<label for="email">Email</label>
				<input id="email" name="email" type="email" autocomplete="username" required />
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
			<button class="btn" type="submit">Masuk</button>
		</form>
	{/if}
</main>

<div class="page-foot-space"></div>
