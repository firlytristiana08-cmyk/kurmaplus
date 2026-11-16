// Format tampilan untuk pembeli: rupiah dan tanggal (PRD: Intl bawaan,
// zona Asia/Jakarta) — dipakai di server dan klien.

const rupiahFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatRupiah(amount: number): string {
	return `Rp${rupiahFormatter.format(amount)}`;
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

// date sudah berupa YYYY-MM-DD (tanggal lokal Asia/Jakarta) — dibaca sebagai
// tengah malam UTC agar tidak bergeser oleh zona waktu pemirsa.
export function formatDateId(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	return dateFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'Asia/Jakarta'
});

export function formatDateTimeId(isoUtc: string): string {
	return `${dateTimeFormatter.format(new Date(isoUtc))} WIB`;
}

export function formatWeight(grams: number): string {
	if (grams >= 1000 && grams % 1000 === 0) {
		return `${grams / 1000} kg`;
	}
	return `${grams} gr`;
}
