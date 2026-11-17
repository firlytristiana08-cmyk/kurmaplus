<script lang="ts">
	// Cangkang Portal Admin: bilah tab 5 tujuan di bawah (PRD — Halaman dan alur).
	import './admin.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	// Pratinjau/dev: bawa ?sesi=demo ke setiap navigasi admin (klik tautan,
	// submit form) karena cookie bisa diblokir di dalam iframe pratinjau.
	// Lihat src/hooks.server.ts. Tidak aktif di produksi.
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const addSesi = (raw: string): string | null => {
			try {
				const u = new URL(raw, location.href);
				if (u.origin !== location.origin || !u.pathname.startsWith('/admin')) return null;
				if (u.search.includes('sesi=demo')) return null;
				u.search = `${u.search}${u.search ? '&' : '?'}sesi=demo`;
				return `${u.pathname}${u.search}${u.hash}`;
			} catch {
				return null;
			}
		};
		const onClick = (e: Event) => {
			const target = e.target as HTMLElement | null;
			const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
			if (!a) return;
			const next = addSesi(a.getAttribute('href') ?? '');
			if (next) a.setAttribute('href', next);
		};
		const onSubmit = (e: Event) => {
			const f = e.target as HTMLFormElement | null;
			if (!f || typeof f.getAttribute !== 'function') return;
			const method = (f.getAttribute('method') ?? 'get').toLowerCase();
			if (method === 'get') {
				// Form GET mengganti query dengan field — pakai input tersembunyi.
				if (!f.querySelector('input[name="sesi"]')) {
					const input = document.createElement('input');
					input.type = 'hidden';
					input.name = 'sesi';
					input.value = 'demo';
					f.appendChild(input);
				}
				return;
			}
			const action = f.getAttribute('action') ?? `${location.pathname}${location.search}`;
			const next = addSesi(action);
			if (next) f.setAttribute('action', next);
		};
		document.addEventListener('click', onClick, true);
		document.addEventListener('submit', onSubmit, true);
		return () => {
			document.removeEventListener('click', onClick, true);
			document.removeEventListener('submit', onSubmit, true);
		};
	});

	const path = $derived(page.url.pathname);
	const tabs = [
		{ href: '/admin', label: 'Hari ini', exact: true },
		{ href: '/admin/pesanan', label: 'Pesanan', exact: false },
		{ href: '/admin/pengiriman', label: 'Pengiriman', exact: false },
		{ href: '/admin/produk', label: 'Produk', exact: false },
		{ href: '/admin/lainnya', label: 'Lainnya', exact: false },
	];

	function isActive(tab: (typeof tabs)[number]): boolean {
		if (tab.exact) return path === '/admin';
		if (tab.href === '/admin/pesanan') return path.startsWith('/admin/pesanan');
		if (tab.href === '/admin/pengiriman') return path.startsWith('/admin/pengiriman');
		if (tab.href === '/admin/produk') return path.startsWith('/admin/produk');
		return (
			path.startsWith('/admin/pengaturan') ||
			path.startsWith('/admin/laporan') ||
			path.startsWith('/admin/log') ||
			path.startsWith('/admin/lainnya')
		);
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<link rel="manifest" href="/admin/manifest.webmanifest" />
	<meta name="theme-color" content="#f4ede0" />
</svelte:head>

{#if !path.startsWith('/admin/masuk')}
	<header class="admin-top no-print">
		<div class="admin-top-inner">
			<p class="top-mark">KURMAPLUS <span>Admin</span></p>
			{#if page.data.session?.email}
				<p class="top-user">{page.data.session.email}</p>
			{/if}
		</div>
	</header>
{/if}

{@render children()}

<nav class="tabbar no-print" aria-label="Navigasi admin">
	{#each tabs as tab (tab.href)}
		<a class="tab" class:is-active={isActive(tab)} href={tab.href} aria-current={isActive(tab) ? 'page' : undefined}>
			{#if tab.href === '/admin'}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 10v11h6v-7h6v7h6V10z" /></svg>
			{:else if tab.href === '/admin/pesanan'}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6v2H9zm0 4h6v2H9z" /></svg>
			{:else if tab.href === '/admin/pengiriman'}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v10H2zM15 9h4l3 3.5V16h-7z" /><circle cx="7" cy="18.5" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /></svg>
			{:else if tab.href === '/admin/produk'}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7zm0 2.3 6.5 3.6L12 11.5 5.5 7.9zM5 9.6l6 3.3v6.6l-6-3.3zm14 0v6.6l-6 3.3v-6.6z" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></svg>
			{/if}
			{tab.label}
		</a>
	{/each}
</nav>
