<script lang="ts">
	// Pengiriman — "layar menjawab: apa yang harus dikemas dan diantar pada
	// tanggal tertentu?" Daftar kemas total per varian; daftar antar per kurir
	// lalu per kota. Cetak A4 hitam putih per lembar: label isi paket
	// (1 kemasan per lembar) dan slip tujuan (1 pesanan per lembar) (AD-15..AD-17).
	import { tick } from 'svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { formatDateId } from '#lib/format';

	let { data } = $props();
	const packing = $derived(data.packing);
	const delivery = $derived(data.delivery);

	function dateUrl(date: string): string {
		return `/admin/pengiriman?tanggal=${date}`;
	}

	// Dua Sabtu/Minggu terdekat untuk chip pilihan tanggal (PRD — AD-14).
	const chips = $derived.by(() => {
		const out: { date: string; label: string }[] = [];
		const probe = new Date();
		for (let i = 0; i < 14 && out.length < 4; i++) {
			const d = new Date(probe.getTime() + (i + 1) * 86_400_000);
			const iso = d.toISOString().slice(0, 10);
			if (d.getUTCDay() === 6) out.push({ date: iso, label: `Sabtu` });
			if (d.getUTCDay() === 0) out.push({ date: iso, label: `Minggu` });
		}
		return out;
	});

	// Cetak per lembar, satu item per lembar — bukan daftar gabungan:
	// label isi paket (1 lembar per kemasan) dan slip tujuan (1 lembar per pesanan).
	type PrintSheet =
		| { kind: 'kemas'; code: string; name: string; isi: string; seq: string }
		| {
				kind: 'antar';
				code: string;
				name: string;
				phone: string;
				address: string;
				note: string | null;
				ongkir: string;
			};

	let sheets: PrintSheet[] = $state([]);
	let printing = $state(false);

	function ongkirLabel(shippingStatus: string): string {
		return shippingStatus === 'paid'
			? 'lunas'
			: shippingStatus === 'billed'
				? 'ditagih'
				: shippingStatus === 'booked'
					? 'kurir dipesan'
					: 'belum dipesan';
	}

	function kemasanSheets(order: (typeof packing.orders)[number]): PrintSheet[] {
		const total = order.packageCount;
		const out: PrintSheet[] = [];
		let i = 0;
		for (const it of order.items) {
			for (let q = 0; q < it.qty; q++) {
				i += 1;
				out.push({
					kind: 'kemas',
					code: order.code,
					name: order.customerName,
					isi: it.name,
					seq: `${i} dari ${total}`,
				});
			}
		}
		return out;
	}

	function antarSheets(
		order: (typeof delivery)[number]['cities'][number]['orders'][number],
	): PrintSheet[] {
		return [
			{
				kind: 'antar',
				code: order.code,
				name: order.customerName,
				phone: order.customerPhone,
				address: order.address,
				note: order.note,
				ongkir: ongkirLabel(order.shippingStatus),
			},
		];
	}

	async function printSheetsNow(list: PrintSheet[]): Promise<void> {
		sheets = list;
		printing = true;
		const cleanup = (): void => {
			printing = false;
			sheets = [];
			window.removeEventListener('afterprint', cleanup);
		};
		window.addEventListener('afterprint', cleanup);
		await tick();
		window.print();
		// Jaga-jaga bila peramban tidak memblokir print() dan tidak mengirim afterprint.
		setTimeout(cleanup, 1500);
	}
</script>

<svelte:head>
	<title>Pengiriman · KURMAPLUS Admin</title>
</svelte:head>

<main class="wrap">
	<header class="admin-head no-print">
		<h1>Pengiriman</h1>
		<p class="muted page-sub">Pilih tanggal kirim untuk melihat kemasan dan antaran.</p>
	</header>

	<div class="chip-row no-print">
		{#each chips as chip (chip.date)}
			<a class="chip" class:is-active={data.date === chip.date} href={dateUrl(chip.date)}>
				{chip.label}, {formatDateId(chip.date)}
			</a>
		{/each}
		<label class="chip" style="cursor: default">
			Tanggal lain
			<input
				type="date"
				value={data.date}
				onchange={(event) => (window.location.href = dateUrl(event.currentTarget.value))}
				style="min-height: 32px; border: none; background: transparent; font-weight: 700"
			/>
		</label>
	</div>

	<div class="print-area">
		{#if !printing}
			<!-- Daftar kemas (AD-15) — label dicetak per kemasan -->
			<section class="print-part">
				<h2 class="print-title">KURMAPLUS — Daftar kemas {formatDateId(data.date)}</h2>
				<div class="section-head">
					<h2>Daftar kemas</h2>
					<span class="aside muted tabular">{packing.orderCount} pesanan · {packing.packageCount} kemasan</span>
				</div>
				<div class="surface is-plain">
					{#if packing.lines.length === 0}
						<p class="muted" style="margin: 0">Belum ada pesanan dikemas untuk tanggal ini.</p>
					{:else}
						{#each packing.lines as line (line.variantId)}
							<div class="row">
								<div class="row-main">
									<div class="row-l1">{line.name} {line.label}</div>
								</div>
								<div class="row-side tabular">{line.qty} kemasan</div>
							</div>
						{/each}
						<hr class="divider" />
						{#each packing.orders as order (order.code)}
							<div class="row">
								<div class="row-main">
									<div class="row-l1">
										{order.code} · {order.customerName}
										<StatusBadge status={order.status} />
									</div>
									<div class="row-l2 tabular">{order.packageCount} kemasan</div>
								</div>
								<div class="row-side">
									<button
										class="btn-mini"
										type="button"
										onclick={() => void printSheetsNow(kemasanSheets(order))}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6v2H9zm0 4h6v2H9z"/></svg>
										Cetak label
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</section>

			<!-- Daftar antar (AD-16) — slip dicetak per pesanan -->
			<div class="section-head">
				<h2>Daftar antar</h2>
			</div>
			{#if delivery.length === 0}
				<div class="surface">
					<p class="muted" style="margin: 0">Belum ada antaran untuk tanggal ini.</p>
				</div>
			{:else}
				{#each delivery as group (group.courier)}
					<section class="print-part">
						<h2 class="print-title">KURMAPLUS — Daftar antar {group.courier} — {formatDateId(data.date)}</h2>
						<div class="group-head">
							<span>
								<svg class="mk" viewBox="0 0 12 12" aria-hidden="true" style="display: inline-block; vertical-align: -1px">
									<path d="M1 3h6v5H1zM8 4.5h2l1.5 1.7V8H8z" fill="currentColor" />
									<circle cx="3.5" cy="9.3" r="1.3" fill="currentColor" />
									<circle cx="9" cy="9.3" r="1.3" fill="currentColor" />
								</svg>
								{group.courier}
							</span>
							<span class="muted tabular">{group.cities.reduce((n, c) => n + c.orders.length, 0)} antaran</span>
						</div>
						{#each group.cities as city (city.city)}
							<p class="group-sub">{city.city}</p>
							<div class="surface">
								{#each city.orders as order (order.code)}
									<div class="row">
										<div class="row-main">
											<div class="row-l1">
												{order.customerName}
												<StatusBadge status={order.status} />
											</div>
											<div class="row-l2 tabular">
												{order.customerPhone} · {order.address}<br />
												{#if order.note}Catatan: {order.note}<br />{/if}
												{order.code} · ongkir {ongkirLabel(order.shippingStatus)}
											</div>
										</div>
										<div class="row-side">
											<button
												class="btn-mini"
												type="button"
												onclick={() => void printSheetsNow(antarSheets(order))}
											>
												<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6v2H9zm0 4h6v2H9z"/></svg>
												Cetak slip
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/each}
					</section>
				{/each}
			{/if}
		{:else}
			<!-- Lembar cetak: satu kemasan / satu pesanan per lembar -->
			{#each sheets as sheet (sheet)}
				<section class="print-sheet">
					<h2 class="print-title">
						{sheet.kind === 'kemas'
							? `KURMAPLUS — Kemasan ${sheet.seq} · ${sheet.code} — ${formatDateId(data.date)}`
							: `KURMAPLUS — Pesanan ${sheet.code} — ${formatDateId(data.date)}`}
					</h2>
					<div class="surface">
						{#if sheet.kind === 'kemas'}
							<div class="row">
								<div class="row-main">
									<div class="row-l1">{sheet.isi}</div>
									<div class="row-l2 tabular">
										{sheet.code} · {sheet.name} · kemasan {sheet.seq}
									</div>
								</div>
							</div>
						{:else}
							<div class="row">
								<div class="row-main">
									<div class="row-l1">{sheet.name}</div>
									<div class="row-l2 tabular">
										{sheet.phone} · {sheet.address}<br />
										{#if sheet.note}Catatan: {sheet.note}<br />{/if}
										{sheet.code} · ongkir {sheet.ongkir}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</section>
			{/each}
		{/if}
	</div>

</main>

<div class="page-foot-space"></div>
