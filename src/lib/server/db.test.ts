import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempDir = mkdtempSync(path.join(tmpdir(), 'kurmaplus-test-'));
process.env['KURMAPLUS_DATA_DIR'] = tempDir;

const db = await import('./db');

const now = new Date('2026-11-11T10:00:00Z');

function makeOrder(code: string, variantId: number, qty: number) {
	return db.createOrder({
		code,
		customerName: 'Budi Santoso',
		customerPhone: '6281234567890',
		address: 'Jalan Kenanga 12',
		city: 'Kota Depok',
		lat: -6.4,
		lng: 106.8,
		courier: 'Grab',
		deliveryDate: '2026-11-14',
		note: null,
		items: [{ variantId, qty }],
		now,
		paymentTimeoutMinutes: 60
	});
}

describe('db: stok, pembayaran, kedaluwarsa (BR-09, BR-11..BR-13, FR-09..FR-13)', () => {
	beforeAll(() => {
		db.getDb();
	});

	afterAll(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('mengunci stok saat pesanan dibuat', () => {
		const before = db.getProductBySlug('sukari')?.variants[0]?.stock ?? -1;
		const result = makeOrder('ORDER001', 1, 2);
		expect(result.ok).toBe(true);
		const after = db.getProductBySlug('sukari')?.variants[0]?.stock ?? -1;
		expect(after).toBe(before - 2);
	});

	it('menolak pesanan saat stok kurang dan tidak mengubah stok', () => {
		const before = db.getProductBySlug('ajwa')?.variants[2]?.stock ?? -1;
		const result = makeOrder('ORDER002', 6, before + 1);
		expect(result).toMatchObject({ ok: false, reason: 'stock' });
		const after = db.getProductBySlug('ajwa')?.variants[2]?.stock ?? -1;
		expect(after).toBe(before);
	});

	it('status berubah sekali walau notifikasi berulang', () => {
		expect(db.markPaidByInvoice('ORDER001', now)).toBe(true);
		expect(db.markPaidByInvoice('ORDER001', now)).toBe(false);
		expect(db.getOrderByCode('ORDER001')?.status).toBe('paid');
	});

	it('event webhook ganda hanya diproses sekali', () => {
		expect(db.recordWebhookEvent('req-duplikat', now)).toBe(true);
		expect(db.recordWebhookEvent('req-duplikat', now)).toBe(false);
	});

	it('pesanan kedaluwarsa mengembalikan stok', () => {
		const before = db.getProductBySlug('tunisia')?.variants[0]?.stock ?? -1;
		const result = makeOrder('ORDER003', 7, 3);
		expect(result.ok).toBe(true);
		expect(db.getProductBySlug('tunisia')?.variants[0]?.stock).toBe(before - 3);

		const future = new Date('2026-11-11T12:00:00Z');
		expect(db.expireStaleOrders(future)).toBe(1);
		expect(db.getOrderByCode('ORDER003')?.status).toBe('expired');
		expect(db.getProductBySlug('tunisia')?.variants[0]?.stock).toBe(before);
	});

	it('lacak hanya cocok dengan kode dan 4 digit terakhir WhatsApp', () => {
		expect(db.findOrderByCodeAndPhoneTail('ORDER001', '7890')?.code).toBe('ORDER001');
		expect(db.findOrderByCodeAndPhoneTail('ORDER001', '0000')).toBeNull();
		expect(db.findOrderByCodeAndPhoneTail('TIDAKADA', '7890')).toBeNull();
	});
});
