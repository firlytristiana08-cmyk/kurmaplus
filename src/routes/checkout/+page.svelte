<script lang="ts">
	import { onMount } from 'svelte';
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
	import type { CheckoutData } from './+page.server';

	let { data, form }: { data: CheckoutData; form?: { message?: string; code?: string } } = $props();

	let nameValue = $state('');
	let phoneValue = $state('');
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

	function handleSubmit(event: SubmitEvent): void {
		if (loading) {
			event.preventDefault();
			return;
		}
		if (!pinSet) {
			event.preventDefault();
			mapMessage = 'Pasang titik tujuan di peta dulu — ketuk peta atau pakai tombol Lokasi saya.';
			return;
		}
		// Pesanan akan dibuat: item yang dibeli keluar dari keranjang (cegah
		// terbeli dua kali). Pemotongan ditulis langsung ke penyimpanan tanpa
		// render supaya form tetap terhubung saat dikirim; cadangan dipakai
		// untuk memulihkan bila ternyata pesanan gagal dibuat.
		backupCart(cart.items);
		commitPurchased(rows.map((row) => ({ variantId: row.variantId, qty: row.qty })));
		// Formulir dikirim (navigasi penuh): tampilkan overlay proses pembayaran.
		loading = true;
	}

	onMount(() => {
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

		<form id="form-checkout" method="POST" onsubmit={handleSubmit} oninvalidcapture={handleInvalid} oninputcapture={clearInvalid}>
			<input type="hidden" name="items" value={itemsJson} />
			<input type="hidden" name="lat" value={latValue} />
			<input type="hidden" name="lng" value={lngValue} />

			<section aria-labelledby="kontak-heading">
				<h2 id="kontak-heading">Kontak</h2>
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
					<input id="email" name="email" type="email" inputmode="email" autocomplete="email" required />
					<p class="hint">Detail pesanan dan bukti pembayaran dikirim ke email ini.</p>
				</div>
			</section>

			<hr class="divider" />

			<section aria-labelledby="lokasi-heading">
				<h2 id="lokasi-heading">Lokasi pengiriman</h2>
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
