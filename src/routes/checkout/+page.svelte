<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDateId, formatRupiah, formatWeight } from '#lib/format';
	import { cart } from '#lib/cart.svelte';
	import PageFooter from '#lib/components/PageFooter.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
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
	let pinSet = $state(false);
	let mapMessage = $state('');

	$effect(() => {
		cart.hydrate();
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
		for (const item of cart.items) {
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
		if (!pinSet) {
			event.preventDefault();
			mapMessage = 'Pasang titik tujuan di peta dulu — ketuk peta atau pakai tombol Lokasi saya.';
		}
	}

	onMount(() => {
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
		return () => cleanup();
	});
</script>

<svelte:head>
	<title>Checkout — KURMAPLUS</title>
	<meta name="description" content="Isi data pengiriman, pilih kurir dan tanggal kirim, lalu bayar." />
</svelte:head>

<PageHeader />

<main class="wrap">
	<h1>Checkout</h1>

	{#if rows.length === 0}
		<p class="muted">Keranjang masih kosong.</p>
		<a class="btn" href="/katalog">Pilih kurma</a>
	{:else}
		{#if form?.message}
			<div class="error-box" role="alert">{form.message}</div>
		{/if}

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
					<p class="hint">Dipakai untuk konfirmasi pengiriman dan halaman lacak.</p>
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
					<label class="choice">
						<input type="radio" name="courier" value="Grab" bind:group={courierValue} />
						<span>Grab</span>
					</label>
					<label class="choice">
						<input type="radio" name="courier" value="Gojek" bind:group={courierValue} />
						<span>Gojek</span>
					</label>
				</div>
				<div class="info-box">
					Ongkir {courierValue} dibayar pemesan saat kurir datang, tidak termasuk total ini.
					{#if data.shippingInfoText}
						{data.shippingInfoText}
					{:else}
						Toko tidak menghitung tarif ongkir.
					{/if}
				</div>
			</section>

			<hr class="divider" />

			<section aria-labelledby="tanggal-heading">
				<h2 id="tanggal-heading">Tanggal kirim</h2>
				<div class="choice-list" role="radiogroup" aria-labelledby="tanggal-heading">
					{#each data.deliveryDates as option (option.date)}
						<label class="choice">
							<input
								type="radio"
								name="deliveryDate"
								value={option.date}
								disabled={option.isFull}
								bind:group={dateValue}
							/>
							<span>
								{option.weekdayName}, {formatDateId(option.date)}
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
				<p class="hint">
					Kurir {courierValue}, dikirim {dateValue ? formatDateId(dateValue) : '(pilih tanggal)'}.
					Ongkir dibayar pemesan di luar total ini.
				</p>
			</section>

		</form>
	{/if}
</main>

<!-- Bilah tombol di luar .wrap agar lebarnya rata kiri-kanan seperti halaman lain. -->
{#if rows.length > 0}
	<div class="sticky-bar">
		<div class="sticky-inner">
			<button type="submit" form="form-checkout" class="btn" disabled={!data.storeOpen}>
				{data.storeOpen ? `Bayar ${formatRupiah(subtotal)}` : 'Toko sedang tutup'}
			</button>
		</div>
	</div>
{/if}

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

	.choice:has(input:checked) {
		border-color: var(--rust);
		background: color-mix(in srgb, var(--rust) 7%, var(--card));
	}

	.choice:has(input:disabled) {
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
