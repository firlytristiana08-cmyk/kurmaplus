<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { formatDateId, formatRupiah, formatWeight } from '#lib/format';
	import {
		backupCart,
		commitPurchased,
		cart,
		readDirectBuy,
		restoreCartBackup,
		type CartItem
	} from '#lib/cart.svelte';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import { stickyBar } from '#lib/sticky-bar';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import ProsesLoader from '#lib/components/ProsesLoader.svelte';
	import { clearInvalid, handleInvalid } from '#lib/validation';
	import type { Snapshot } from './$types';
	import type { CheckoutData } from './+page.server';

	let { data, form }: { data: CheckoutData; form?: { message?: string; code?: string } } = $props();

	let nameValue = $state('');
	let phoneValue = $state('');
	let emailValue = $state('');
	let addressValue = $state('');
	let cityValue = $state('');
	let noteValue = $state('');
	let courierValue = $state('Grab');
	let dateValue = $state('');
	let latValue = $state('');
	let lngValue = $state('');
	let loading = $state(false);
	let pinSet = $state(false);
	let mapMessage = $state('');
	let formNotice = $state('');
	// Kategori form (dropdown): default tertutup.
	let kontakOpen = $state(false);
	let lokasiOpen = $state(false);
	// Item checkout: daftar "beli langsung" bila ada, selain itu isi keranjang.
	let directBuy = $state<CartItem[] | null | undefined>(undefined);

	$effect(() => {
		cart.hydrate();
		// Mode beli langsung hanya berlaku bila dibuka lewat tombol "Beli
		// langsung" (?beli=1) — tanpa parameter, checkout memakai keranjang.
		directBuy = data.directMode ? readDirectBuy() : null;
	});

	$effect(() => {
		// Pesanan gagal dibuat: kembalikan keranjang seperti sebelum dikirim.
		// Bila pesanan sudah ada (form.code terisi, mis. halaman bayar DOKU yang
		// gagal dibuka), jangan dipulihkan — barang sudah tercatat terbeli.
		if (form?.message && !form.code) {
			restoreCartBackup();
			// Kategori yang belum lengkap dibuka supaya langsung terlihat.
			untrack(() => {
				if (!kontakLengkap) kontakOpen = true;
				if (!lokasiLengkap) lokasiOpen = true;
			});
		}
	});

	const rows = $derived.by(() => {
		const found: {
			variantId: number;
			name: string;
			label: string;
			weightGrams: number;
			priceIdr: number;
			qty: number;
			stock: number;
		}[] = [];
		for (const item of data.directMode ? (directBuy ?? []) : cart.items) {
			for (const product of data.products) {
				const variant = product.variants.find((candidate) => candidate.id === item.variantId);
				if (variant) {
					found.push({
						variantId: item.variantId,
						name: product.name,
						label: variant.label,
						weightGrams: variant.weightGrams,
						priceIdr: variant.priceIdr,
						qty: item.qty,
						stock: variant.stock
					});
				}
			}
		}
		return found;
	});

	const subtotal = $derived(rows.reduce((sum, row) => sum + row.priceIdr * row.qty, 0));
	const itemsJson = $derived(JSON.stringify(rows.map((row) => ({ variantId: row.variantId, qty: row.qty }))));

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	// Status kategori: terisi lengkap DAN formatnya benar (aturan server diikuti).
	const kontakLengkap = $derived(
		nameValue.trim().length >= 2 &&
			nameValue.trim().length <= 80 &&
			phoneValue.trim().length >= 8 &&
			EMAIL_RE.test(emailValue.trim())
	);
	const lokasiLengkap = $derived(
		addressValue.trim().length >= 5 &&
			addressValue.trim().length <= 200 &&
			cityValue !== '' &&
			pinSet
	);

	// Isian form yang tersimpan di riwayat peramban (opsi A): kembali ke halaman
	// ini mengisi ulang field. Batas 24 jam untuk data basi; setelah pesanan
	// sukses dikirim, isian lama dibersihkan dan tidak dipulihkan lagi.
	type CheckoutDraft = {
		name: string;
		phone: string;
		email: string;
		address: string;
		city: string;
		note: string;
		courier: string;
		date: string;
		lat: string;
		lng: string;
		pin: boolean;
		savedAt: number;
	};

	const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
	const SUBMITTED_KEY = 'kurma-checkout-submitted';
	const FAILSAFE_KEY = 'kurma-checkout-draft';

	function draftOf(): CheckoutDraft {
		return {
			name: nameValue,
			phone: phoneValue,
			email: emailValue,
			address: addressValue,
			city: cityValue,
			note: noteValue,
			courier: courierValue,
			date: dateValue,
			lat: latValue,
			lng: lngValue,
			pin: pinSet,
			savedAt: Date.now()
		};
	}

	function applyDraft(draft: CheckoutDraft): void {
		if (Date.now() - draft.savedAt > DRAFT_TTL_MS) return;
		nameValue = draft.name;
		phoneValue = draft.phone;
		emailValue = draft.email;
		addressValue = draft.address;
		cityValue = data.cities.includes(draft.city) ? draft.city : '';
		noteValue = draft.note;
		courierValue = draft.courier === 'Gojek' ? 'Gojek' : 'Grab';
		dateValue = data.deliveryDates.some((option) => option.date === draft.date && !option.isFull)
			? draft.date
			: '';
		latValue = draft.lat;
		lngValue = draft.lng;
		pinSet = draft.pin && Boolean(draft.lat && draft.lng);
	}

	export const snapshot: Snapshot<CheckoutDraft> = {
		capture: () => draftOf(),
		restore: (draft) => {
			if (sessionStorage.getItem(SUBMITTED_KEY)) {
				// Pesanan terakhir sukses dikirim — isian lama tidak dipulihkan.
				sessionStorage.removeItem(SUBMITTED_KEY);
				sessionStorage.removeItem(FAILSAFE_KEY);
				return;
			}
			applyDraft(draft);
		}
	};

	function onInputCapture(event: Event): void {
		clearInvalid(event);
		formNotice = '';
	}

	function handleSubmit(event: SubmitEvent): void {
		if (loading) {
			event.preventDefault();
			return;
		}
		if (!pinSet) {
			event.preventDefault();
			lokasiOpen = true;
			mapMessage = 'Pasang titik tujuan di peta dulu — ketuk peta atau pakai tombol Lokasi saya.';
			return;
		}
		if (!kontakLengkap || !lokasiLengkap) {
			event.preventDefault();
			if (!kontakLengkap) kontakOpen = true;
			if (!lokasiLengkap) lokasiOpen = true;
			formNotice = 'Lengkapi isian yang bertanda "Belum" sebelum melanjutkan.';
			return;
		}
		// Pesanan akan dibuat: item yang dibeli keluar dari keranjang (cegah
		// terbeli dua kali). Pemotongan ditulis langsung ke penyimpanan tanpa
		// render supaya form tetap terhubung saat dikirim; cadangan dipakai
		// untuk memulihkan bila ternyata pesanan gagal dibuat.
		backupCart(cart.items);
		commitPurchased(rows.map((row) => ({ variantId: row.variantId, qty: row.qty })));
		// Catat isian terakhir untuk pemulihan bila submit gagal di server, dan
		// tandai bahwa pesanan sudah dikirim agar isian lama tidak dipulihkan.
		try {
			sessionStorage.setItem(FAILSAFE_KEY, JSON.stringify(draftOf()));
			sessionStorage.setItem(SUBMITTED_KEY, '1');
		} catch {
			/* penyimpanan penuh/di-block — abaikan */
		}
		// Formulir dikirim (navigasi penuh): tampilkan overlay proses pembayaran.
		loading = true;
	}

	onMount(() => {
		// Submit form memuat ulang halaman: bila server menolak, pasang kembali
		// isian yang baru dikirim supaya pengguna tidak mengisi ulang.
		if (form?.message && !form.code) {
			const raw = sessionStorage.getItem(FAILSAFE_KEY);
			sessionStorage.removeItem(FAILSAFE_KEY);
			sessionStorage.removeItem(SUBMITTED_KEY);
			if (raw) {
				try {
					applyDraft(JSON.parse(raw) as CheckoutDraft);
				} catch {
					/* data draft rusak — abaikan */
				}
			}
		}
		// Kembali dari cache (mis. tombol back setelah halaman bayar): sembunyikan overlay.
		const onPageShow = (): void => {
			loading = false;
		};
		window.addEventListener('pageshow', onPageShow);
		let cleanup = () => {};
		void (async () => {
			const leaflet = await import('leaflet');
			await import('leaflet/dist/leaflet.css');
			const mapElement = document.getElementById('peta-checkout');
			if (!mapElement) {
				return;
			}
			const map = leaflet.map(mapElement).setView([-6.2, 106.85], 11);
			leaflet
				.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
				})
				.addTo(map);
			// Ikon pin kustom (SVG inline). Ikon bawaan Leaflet memakai berkas PNG
			// yang kerap gagal dimuat setelah proses build, dan warnanya biru di
			// luar identitas toko. Pin terisi warna bata dengan titik putih dan
			// garis navy — konsisten dengan tombol dan kartu KURMAPLUS.
			const pinSvg =
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 46" width="34" height="46">' +
				'<path d="M17 2C9.3 2 3 8.3 3 16c0 10.6 14 28 14 28s14-17.4 14-28c0-7.7-6.3-14-14-14z" fill="#AB3710" stroke="#2D264B" stroke-width="2" stroke-linejoin="round"/>' +
				'<circle cx="17" cy="16" r="5" fill="#FFFFFF"/></svg>';
			const pinIcon = leaflet.icon({
				iconUrl: `data:image/svg+xml,${encodeURIComponent(pinSvg)}`,
				iconSize: [34, 46],
				iconAnchor: [17, 45]
			});

			let marker: import('leaflet').Marker | null = null;

			const placePin = (lat: number, lng: number): void => {
				if (marker) {
					marker.setLatLng([lat, lng]);
				} else {
					marker = leaflet.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
					marker.on('dragend', () => {
						const position = marker?.getLatLng();
						if (position) {
							latValue = position.lat.toFixed(6);
							lngValue = position.lng.toFixed(6);
							pinSet = true;
							mapMessage = '';
						}
					});
				}
				latValue = lat.toFixed(6);
				lngValue = lng.toFixed(6);
				pinSet = true;
				mapMessage = '';
			};

			map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
				placePin(event.latlng.lat, event.latlng.lng);
			});

			// Pin dari isian yang tersimpan (kembali dari riwayat/gagal submit).
			if (pinSet && latValue && lngValue) {
				placePin(Number(latValue), Number(lngValue));
				map.setView([Number(latValue), Number(lngValue)], 14);
			}

			const locateButton = document.getElementById('tombol-lokasi');
			const onLocate = (): void => {
				mapMessage = 'Mencari lokasi Anda…';
				navigator.geolocation.getCurrentPosition(
					(position) => {
						placePin(position.coords.latitude, position.coords.longitude);
						map.setView([position.coords.latitude, position.coords.longitude], 14);
					},
					() => {
						mapMessage =
							'Lokasi tidak bisa dibaca. Ketuk peta untuk memasang pin secara manual.';
					}
				);
			};
			locateButton?.addEventListener('click', onLocate);

			cleanup = () => {
				locateButton?.removeEventListener('click', onLocate);
				map.remove();
			};
		})();
		return () => {
			window.removeEventListener('pageshow', onPageShow);
			cleanup();
		};
	});
</script>

<svelte:head>
	<title>Checkout — KURMAPLUS</title>
	<meta name="description" content="Isi data pengiriman, pilih kurir dan tanggal kirim, lalu bayar." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<h1>Checkout</h1>

	{#if form?.message}
		<div class="error-box" role="alert">{form.message}</div>
	{:else if formNotice}
		<div class="error-box" role="alert">{formNotice}</div>
	{/if}

	{#if rows.length === 0}
		{#if data.directMode && directBuy === null}
			<p class="muted">
				Sesi beli langsung sudah berakhir — pilih produknya lagi untuk membeli langsung.
			</p>
		{:else}
			<p class="muted">Keranjang masih kosong.</p>
		{/if}
		<a class="btn" href="/katalog">Pilih kurma</a>
	{:else}
		{#if !data.storeOpen}
			<div class="error-box" role="alert">
				Maaf, toko sedang tutup sementara sehingga pesanan baru belum bisa dibuat. Silakan
				kembali lagi nanti.
			</div>
		{/if}

		<form id="form-checkout" method="POST" onsubmit={handleSubmit} oninvalidcapture={handleInvalid} oninputcapture={onInputCapture}>
			<input type="hidden" name="items" value={itemsJson} />
			<input type="hidden" name="lat" value={latValue} />
			<input type="hidden" name="lng" value={lngValue} />

			<section class="acc" aria-labelledby="kontak-heading">
				<h2 class="acc-h2" id="kontak-heading">
				<button
					type="button"
					class="acc-head"
					aria-expanded={kontakOpen}
					aria-controls="acc-body"
					onclick={() => (kontakOpen = !kontakOpen)}
				>
					<span class="acc-title">Informasi pribadi (kontak)</span>
					<span class="badge" class:badge-ok={kontakLengkap} class:badge-off={!kontakLengkap}>
						{#if kontakLengkap}
							<svg class="acc-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>Lengkap
						{:else}
							<svg class="acc-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z" /></svg>Belum
						{/if}
					</span>
					<svg class="acc-chevron" class:is-open={kontakOpen} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
				</button>
				</h2>
				{#if kontakOpen}
				<div id="kontak-body" class="acc-body">
				<div class="field">
					<label for="customerName">Nama <span class="required-mark">*</span></label>
					<input
						id="customerName"
						name="customerName"
						type="text"
						autocomplete="name"
						required
						minlength="2"
						bind:value={nameValue}
					/>
				</div>
				<div class="field">
					<label for="customerPhone">Nomor WhatsApp <span class="required-mark">*</span></label>
					<input
						id="customerPhone"
						name="customerPhone"
						type="tel"
						inputmode="tel"
						autocomplete="tel"
						placeholder="08xxxxxxxxxx"
						required
						bind:value={phoneValue}
					/>
					<p class="hint">Dipakai untuk konfirmasi pengiriman dan melacak pesanan.</p>
				</div>
				<div class="field">
					<label for="email">Email <span class="required-mark">*</span></label>
										<input
						id="email"
						name="email"
						type="email"
						inputmode="email"
						autocomplete="email"
						required
						bind:value={emailValue}
					/>
					<p class="hint">Detail pesanan dan bukti pembayaran dikirim ke email ini.</p>
				</div>
				</div>
				{/if}
			</section>

			<hr class="divider" />

			<section class="acc" aria-labelledby="lokasi-heading">
				<h2 class="acc-h2" id="lokasi-heading">
				<button
					type="button"
					class="acc-head"
					aria-expanded={lokasiOpen}
					aria-controls="acc-body"
					onclick={() => (lokasiOpen = !lokasiOpen)}
				>
					<span class="acc-title">Lokasi pengiriman</span>
					<span class="badge" class:badge-ok={lokasiLengkap} class:badge-off={!lokasiLengkap}>
						{#if lokasiLengkap}
							<svg class="acc-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>Lengkap
						{:else}
							<svg class="acc-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z" /></svg>Belum
						{/if}
					</span>
					<svg class="acc-chevron" class:is-open={lokasiOpen} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
				</button>
				</h2>
				{#if lokasiOpen}
				<div id="lokasi-body" class="acc-body">
				<div class="field">
					<label for="address">Alamat <span class="required-mark">*</span></label>
					<textarea
						id="address"
						name="address"
						required
						minlength="5"
						autocomplete="street-address"
						bind:value={addressValue}
					></textarea>
				</div>
				<div class="field">
					<label for="city">Kota atau kabupaten <span class="required-mark">*</span></label>
					<select id="city" name="city" required bind:value={cityValue}>
						<option value="" disabled>Pilih kota/kabupaten</option>
						{#each data.cities as city (city)}
							<option value={city}>{city}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="note">Patokan atau catatan (opsional)</label>
					<input id="note" name="note" type="text" maxlength="500" bind:value={noteValue} />
				</div>

				<div class="map-block">
					<div id="peta-checkout" class="map" role="application" aria-label="Peta lokasi pengiriman"></div>
					<button type="button" id="tombol-lokasi" class="btn btn-secondary">Lokasi saya</button>
					{#if mapMessage}
						<p class="error-text" role="status">{mapMessage}</p>
					{:else if pinSet}
						<p class="hint">Titik tujuan terpasang: {latValue}, {lngValue}.</p>
					{:else}
						<p class="hint">Ketuk peta atau pakai tombol Lokasi saya untuk memasang titik tujuan kurir.</p>
					{/if}
				</div>
				</div>
				{/if}
			</section>

			<hr class="divider" />

			<section aria-labelledby="kurir-heading">
				<h2 id="kurir-heading">Kurir</h2>
				<div class="choice-list" role="radiogroup" aria-labelledby="kurir-heading">
					<label class="choice" class:choice-on={courierValue === 'Grab'}>
						<input type="radio" name="courier" value="Grab" bind:group={courierValue} />
						<span class="choice-label"><svg class="choice-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H11v2H7.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" /></svg>Grab</span>
					</label>
					<label class="choice" class:choice-on={courierValue === 'Gojek'}>
						<input type="radio" name="courier" value="Gojek" bind:group={courierValue} />
						<span class="choice-label"><svg class="choice-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H11v2H7.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" /></svg>Gojek</span>
					</label>
				</div>
				<div class="info-box">
					{#if data.shippingInfoText}
						{@const [judulInfo, ...sisaInfo] = data.shippingInfoText.split('\n')}
						<strong class="info-title">{judulInfo}</strong>
						{#if sisaInfo.length > 0}
							<span class="info-rest">{sisaInfo.join('\n')}</span>
						{/if}
					{:else}
						Ongkir mengikuti tarif kurir, dibayar langsung ke kurir — di luar total ini.
					{/if}
				</div>
			</section>

			<hr class="divider" />

			<section aria-labelledby="tanggal-heading">
				<h2 id="tanggal-heading">Tanggal kirim</h2>
				<div class="choice-list" role="radiogroup" aria-labelledby="tanggal-heading">
					{#each data.deliveryDates as option (option.date)}
						<label class="choice" class:choice-on={dateValue === option.date} class:choice-off={option.isFull}>
							<input
								type="radio"
								name="deliveryDate"
								value={option.date}
								disabled={option.isFull}
								bind:group={dateValue}
							/>
							<span class="choice-label">
								<svg class="choice-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" /></svg>{option.weekdayName}, {formatDateId(option.date)}
								{#if option.isFull}<span class="badge badge-off">Penuh</span>{/if}
							</span>
						</label>
					{/each}
				</div>
				<p class="hint">Hanya Sabtu dan Minggu. Pesanan setelah Kamis 23.59 masuk akhir pekan berikutnya.</p>
			</section>

			<hr class="divider" />

			<section aria-labelledby="ringkasan-heading">
				<h2 id="ringkasan-heading">Ringkasan</h2>
				<ul class="summary-list">
					{#each rows as row (row.variantId)}
						<li>
							<span>{row.name} {formatWeight(row.weightGrams)} × {row.qty}</span>
							<span class="tabular">{formatRupiah(row.priceIdr * row.qty)}</span>
						</li>
					{/each}
				</ul>
				<div class="total-row">
					<span>Total</span>
					<strong class="tabular">{formatRupiah(subtotal)}</strong>
				</div>
			</section>

		</form>
	{/if}
</main>

<!-- Bilah tombol di luar .wrap agar lebarnya rata kiri-kanan seperti halaman lain. -->
{#if rows.length > 0}
	<div class="sticky-bar" use:stickyBar>
		<div class="sticky-inner">
			<button
				type="submit"
				form="form-checkout"
				class="btn"
				disabled={!data.storeOpen || loading} aria-busy={loading}>
				{data.storeOpen ? `Bayar ${formatRupiah(subtotal)}` : 'Toko sedang tutup'}
			</button>
		</div>
	</div>
{/if}

<ProsesLoader show={loading} />

<PageFooter />

<style>
	.map-block {
		display: grid;
		gap: 0.625rem;
		margin-bottom: 1rem;
	}

	/* isolation: z-index internal peta Leaflet tidak boleh menutupi tombol di atasnya. */
	.map {
		width: 100%;
		height: 240px;
		border: 1.5px solid var(--sand);
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--sand);
		isolation: isolate;
	}

	.choice-label {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.choice-icon {
		display: block;
		flex: none;
		width: 18px;
		height: 18px;
	}

	.choice-list {
		display: grid;
		gap: 0.625rem;
		margin-bottom: 0.875rem;
	}

	.choice {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 48px;
		padding: 0.5rem 0.875rem;
		border: 1.5px solid var(--sand);
		border-radius: var(--radius-m);
		background: var(--card);
		font-weight: 700;
		cursor: pointer;
	}

	.choice input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--rust);
	}

	.choice:has(input:checked),
	.choice-on {
		border-color: var(--rust);
		background: #f9efe8;
		background: color-mix(in srgb, var(--rust) 7%, var(--card));
	}

	.choice:has(input:disabled),
	.choice-off {
		opacity: 0.55;
		cursor: not-allowed;
	}

	/* Kategori form (dropdown) dengan status lengkap/belum di judulnya. */
	.acc-h2 {
		margin: 0;
	}

	.acc-head {
		display: flex;
		width: 100%;
		min-height: 48px;
		align-items: center;
		gap: 0.5rem;
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
		text-align: left;
		cursor: pointer;
	}

	.acc-title {
		flex: 1;
	}

	.acc-icon {
		width: 0.875rem;
		height: 0.875rem;
		flex: none;
	}

	.acc-chevron {
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		transition: transform 150ms ease-out;
	}

	.acc-chevron.is-open {
		transform: rotate(180deg);
	}

	.acc-body {
		padding-top: 0.25rem;
	}

	.summary-list {
		list-style: none;
		margin: 0 0 0.75rem;
		padding: 0;
	}

	.summary-list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.375rem 0;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 1.125rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--sand);
	}
</style>
