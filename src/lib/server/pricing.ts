// Logika uang (BR-10): murni, tanpa I/O, wajib bertes (PRD aturan vibe coding 2).
// Uang disimpan dan dihitung sebagai bilangan bulat rupiah.

export interface OrderLine {
	priceIdr: number;
	qty: number;
}

export class PricingError extends Error {}

function assertIdr(value: number, field: string): void {
	if (!Number.isInteger(value) || value < 0) {
		throw new PricingError(`${field} harus bilangan bulat rupiah yang sah`);
	}
}

export function lineTotalIdr(line: OrderLine): number {
	assertIdr(line.priceIdr, 'Harga');
	if (!Number.isInteger(line.qty) || line.qty < 1) {
		throw new PricingError('Jumlah barang minimal 1');
	}
	return line.priceIdr * line.qty;
}

export function subtotalIdr(lines: OrderLine[]): number {
	if (lines.length === 0) {
		throw new PricingError('Keranjang kosong');
	}
	let sum = 0;
	for (const line of lines) {
		sum += lineTotalIdr(line);
	}
	return sum;
}

// BR-10: total = subtotal, tanpa ongkir dan tanpa baris pajak.
export function totalIdr(subtotal: number): number {
	assertIdr(subtotal, 'Subtotal');
	return subtotal;
}
