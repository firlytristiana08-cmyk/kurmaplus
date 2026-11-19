<script lang="ts">
	// Pengiriman — "layar menjawab: apa yang harus dikemas dan diantar pada
	// tanggal tertentu?" Daftar kemas total per varian; daftar antar per kurir
	// lalu per kota; cetak A4 hitam putih (AD-15..AD-17).
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

	// Cetak per bagian (masing-masing, bukan keseluruhan): 'kemas' untuk daftar
	// kemas, `antar:<kurir>` untuk daftar antar tiap kurir. Bagian lain
	// disembunyikan selama dialog cetak terbuka.
	let printTarget: string | null = $state(null);

	function printPart(target: string): void {
		printTarget = target;
		const cleanup = (): void => {
			printTarget = null;
			window.removeEventListener('afterprint', cleanup);
		};
		window.addEventListener('afterprint', cleanup);
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
		<!-- Daftar kemas (AD-15) — dicetak sendiri -->
		<section class="print-part" hidden={printTarget !== null && printTarget !== 'kemas'}>
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
						</div>
					{/each}
				{/if}
			</div>
		</section>

		<!-- Daftar antar (AD-16) — dicetak per kurir, masing-masing hanya daftarnya sendiri -->
		<div class="section-head">
			<h2>Daftar antar</h2>
		</div>
		{#if delivery.length === 0}
			<div class="surface">
				<p class="muted" style="margin: 0">Belum ada antaran untuk tanggal ini.</p>
			</div>
		{:else}
			{#each delivery as group (group.courier)}
				<section class="print-part" hidden={printTarget !== null && printTarget !== `antar:${group.courier}`}>
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
						<span class="print-aside">
							<span class="muted tabular">{group.cities.reduce((n, c) => n + c.orders.length, 0)} antaran</span>
							<button
								class="btn-mini no-print"
								type="button"
								onclick={() => printPart(`antar:${group.courier}`)}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6v2H9zm0 4h6v2H9z"/></svg>
								Cetak
							</button>
						</span>
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
											{order.code} · ongkir
											{order.shippingStatus === 'paid'
												? 'lunas'
												: order.shippingStatus === 'billed'
													? 'ditagih'
													: order.shippingStatus === 'booked'
														? 'kurir dipesan'
														: 'belum dipesan'}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</section>
			{/each}
		{/if}
	</div>

	<div class="admin-sticky no-print">
		<div class="wrap" style="padding: 0">
			<button class="btn" type="button" onclick={() => printPart('kemas')}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6v2H9zm0 4h6v2H9z"/></svg>
				Cetak daftar kemas
			</button>
			<p class="sticky-hint">A4 hitam putih · daftar antar dicetak per kurir dari bloknya</p>
		</div>
	</div>
</main>

<div class="page-foot-space"></div>
