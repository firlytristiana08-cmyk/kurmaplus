<script lang="ts">
	// Gerbang masuk pemilik (PRD Portal Admin — Autentikasi).

	interface MasukForm {
		message?: string;
		needsMfa?: boolean;
		needsEnroll?: boolean;
		email?: string;
		qrSvg?: string;
		secret?: string;
	}

	let { data, form }: { data: import('./$types').PageData; form?: MasukForm } = $props();
	const needsMfa = $derived(form?.needsMfa === true);
	const needsEnroll = $derived(form?.needsEnroll === true);
	const qrSafe = $derived(
		typeof form?.qrSvg === 'string' &&
			form.qrSvg.startsWith('<svg') &&
			!form.qrSvg.toLowerCase().includes('<script') &&
			!form.qrSvg.toLowerCase().includes('onload')
	);
	const secretGrouped = $derived(
		typeof form?.secret === 'string' ? form.secret.replace(/(.{4})/g, '$1 ').trim() : ''
	);
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
				Mode pengembangan — masuk memakai sesi demo pemilik. Login Supabase Auth (email,
				password, kode authenticator) aktif di produksi.
			</p>
			<form method="POST" action="?/demo">
				<button class="btn" type="submit">Masuk sebagai pemilik (demo)</button>
			</form>
		</div>
	{:else}
		<form class="surface" method="POST" action="?/masuk">
			{#if needsEnroll}
				<p class="info-box" style="margin-top: 0">
					Aktivasi authenticator (MFA) wajib sekali di awal. Pindai QR di bawah dengan aplikasi
					authenticator (Google Authenticator, Authy, atau sejenisnya), lalu masukkan kode 6 digit
					yang muncul.
				</p>
				{#if qrSafe && form?.qrSvg}
					<div class="qr-box">{@html form.qrSvg}</div>
				{/if}
				{#if secretGrouped}
					<p class="hint">
						Tidak bisa memindai? Tambahkan akun secara manual dengan kunci: <code
							>{secretGrouped}</code
						>
					</p>
				{/if}
				<div class="field">
					<label for="totp">Kode authenticator</label>
					<input
						id="totp"
						name="totp"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						required
					/>
				</div>
				<button class="btn" type="submit">Aktifkan dan masuk</button>
			{:else if needsMfa}
				<p class="info-box">Masukkan kode 6 digit dari aplikasi authenticator Anda.</p>
				<div class="field">
					<label for="totp">Kode authenticator</label>
					<input
						id="totp"
						name="totp"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						required
					/>
				</div>
				<button class="btn" type="submit">Verifikasi kode</button>
			{:else}
				<div class="field">
					<label for="email">Email</label>
					<input id="email" name="email" type="email" autocomplete="username" required />
				</div>
				<div class="field">
					<label for="password">Password</label>
					<input id="password" name="password" type="password" autocomplete="current-password" required />
				</div>
				<button class="btn" type="submit">Masuk</button>
			{/if}
		</form>
	{/if}
</main>

<div class="page-foot-space"></div>

<style>
	.qr-box {
		display: flex;
		justify-content: center;
		padding: 0.75rem;
		background: #fff;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, var(--paper));
		border-radius: 8px;
		margin-bottom: 0.75rem;
	}

	.qr-box :global(svg) {
		width: 11rem;
		height: 11rem;
	}

	.hint {
		font-size: 0.8125rem;
		color: color-mix(in srgb, var(--ink) 62%, var(--paper));
		margin: 0 0 0.75rem;
	}

	.hint code {
		font-weight: 700;
		word-break: break-all;
	}
</style>
