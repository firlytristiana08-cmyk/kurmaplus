// Akses data (PRD: Model data, D1/SQLite). Antarmuka meniru D1
// (prepare().bind().all/get/run) dan SQL yang sama dipakai saat pindah ke
// Cloudflare D1; di sandbox berjalan di atas node:sqlite dengan berkas
// .data/kurmaplus.db yang dibuat dari db/migrations + db/seed.sql.

import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { OrderStatus } from './orders';
import { generateOrderCode } from './orders';
import { subtotalIdr, totalIdr } from './pricing';

type SqlValue = string | number | bigint | null | Uint8Array;

interface BoundStatement {
	all<T>(): T[];
	get<T>(): T | undefined;
	run(): { changes: number };
}

interface PreparedStatement {
	bind(...params: SqlValue[]): BoundStatement;
}

export interface Db {
	prepare(sql: string): PreparedStatement;
	exec(sql: string): void;
}

class SqliteDb implements Db {
	#raw: DatabaseSync;

	constructor(file: string) {
		this.#raw = new DatabaseSync(file);
	}

	prepare(sql: string): PreparedStatement {
		const statement: StatementSync = this.#raw.prepare(sql);
		return {
			bind(...params: SqlValue[]): BoundStatement {
				return {
					all<T>(): T[] {
						return statement.all(...params) as T[];
					},
					get<T>(): T | undefined {
						return statement.get(...params) as T | undefined;
					},
					run(): { changes: number } {
						const result = statement.run(...params);
						return { changes: Number(result.changes) };
					}
				};
			}
		};
	}

	exec(sql: string): void {
		this.#raw.exec(sql);
	}
}

let instance: Db | null = null;

export function getDb(): Db {
	if (instance !== null) {
		return instance;
	}
	// KURMAPLUS_DATA_DIR hanya untuk pengujian; produksi memakai .data.
	const dataDir = process.env['KURMAPLUS_DATA_DIR'] ?? path.join(process.cwd(), '.data');
	mkdirSync(dataDir, { recursive: true });
	const db = new SqliteDb(path.join(dataDir, 'kurmaplus.db'));
	db.exec(readFileSync(path.join(process.cwd(), 'db/migrations/0001_init.sql'), 'utf8'));
	const seeded = db.prepare('SELECT COUNT(*) AS n FROM products').bind().get<{ n: number }>();
	if ((seeded?.n ?? 0) === 0) {
		db.exec(readFileSync(path.join(process.cwd(), 'db/seed.sql'), 'utf8'));
	}
	instance = db;
	return db;
}

export function getSettings(): Record<string, string> {
	const rows = getDb().prepare('SELECT key, value FROM settings').bind().all<{ key: string; value: string }>();
	const settings: Record<string, string> = {};
	for (const row of rows) {
		settings[row.key] = row.value;
	}
	return settings;
}

export interface VariantView {
	id: number;
	label: string;
	weightGrams: number;
	priceIdr: number;
	stock: number;
}

export interface ProductView {
	id: number;
	slug: string;
	name: string;
	description: string;
	photo: string | null;
	variants: VariantView[];
	minPriceIdr: number;
	allOutOfStock: boolean;
}

interface VariantRow {
	id: number;
	product_id: number;
	label: string;
	weight_grams: number;
	price_idr: number;
	stock: number;
}

function variantsOf(productId: number): VariantView[] {
	const rows = getDb()
		.prepare('SELECT id, product_id, label, weight_grams, price_idr, stock FROM variants WHERE product_id = ? AND is_active = 1 ORDER BY weight_grams')
		.bind(productId)
		.all<VariantRow>();
	return rows.map((row) => ({
		id: row.id,
		label: row.label,
		weightGrams: row.weight_grams,
		priceIdr: row.price_idr,
		stock: row.stock
	}));
}

interface ProductRow {
	id: number;
	slug: string;
	name: string;
	description: string;
	photo: string | null;
}

function toProductView(row: ProductRow): ProductView {
	const variants = variantsOf(row.id);
	const prices = variants.map((variant) => variant.priceIdr);
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		description: row.description,
		photo: row.photo,
		variants,
		minPriceIdr: prices.length > 0 ? Math.min(...prices) : 0,
		allOutOfStock: variants.every((variant) => variant.stock <= 0)
	};
}

export function listProducts(): ProductView[] {
	const rows = getDb()
		.prepare('SELECT id, slug, name, description, photo FROM products WHERE is_active = 1 ORDER BY sort_order')
		.bind()
		.all<ProductRow>();
	return rows.map(toProductView);
}

export function getProductBySlug(slug: string): ProductView | null {
	const row = getDb()
		.prepare('SELECT id, slug, name, description, photo FROM products WHERE slug = ? AND is_active = 1')
		.bind(slug)
		.get<ProductRow>();
	return row ? toProductView(row) : null;
}

export interface CreateOrderInput {
	code: string;
	customerName: string;
	customerPhone: string;
	address: string;
	city: string;
	lat: number;
	lng: number;
	courier: 'Grab' | 'Gojek';
	deliveryDate: string;
	note: string | null;
	items: { variantId: number; qty: number }[];
	now: Date;
	paymentTimeoutMinutes: number;
}

export type CreateOrderResult =
	| { ok: true; code: string; totalIdr: number }
	| { ok: false; reason: 'stock'; variantId: number; requested: number; available: number };

interface OrderRow {
	id: number;
	code: string;
	status: OrderStatus;
	customer_name: string;
	customer_phone: string;
	address: string;
	city: string;
	lat: number;
	lng: number;
	courier: string;
	delivery_date: string;
	subtotal_idr: number;
	total_idr: number;
	note: string | null;
	created_at: string;
	expires_at: string;
	paid_at: string | null;
}

// BR-09 + FR-09: penguncian stok dan pembuatan pesanan dalam satu transaksi.
export function createOrder(input: CreateOrderInput): CreateOrderResult {
	const db = getDb();
	db.exec('BEGIN');
	try {
		const lines: { priceIdr: number; qty: number }[] = [];
		const snapshots: { variantId: number; name: string; priceIdr: number; qty: number }[] = [];
		for (const item of input.items) {
			const variant = db
				.prepare(
					'SELECT v.id, v.label, v.stock, v.price_idr, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = 1'
				)
				.bind(item.variantId)
				.get<{ id: number; label: string; stock: number; price_idr: number; product_name: string }>();
			if (!variant || variant.stock < item.qty) {
				db.exec('ROLLBACK');
				return {
					ok: false,
					reason: 'stock',
					variantId: item.variantId,
					requested: item.qty,
					available: variant?.stock ?? 0
				};
			}
			const locked = db
				.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
				.bind(item.qty, item.variantId, item.qty)
				.run();
			if (locked.changes < 1) {
				db.exec('ROLLBACK');
				return {
					ok: false,
					reason: 'stock',
					variantId: item.variantId,
					requested: item.qty,
					available: 0
				};
			}
			lines.push({ priceIdr: variant.price_idr, qty: item.qty });
			snapshots.push({
				variantId: item.variantId,
				name: `${variant.product_name} ${variant.label}`,
				priceIdr: variant.price_idr,
				qty: item.qty
			});
		}

		const subtotal = subtotalIdr(lines);
		const total = totalIdr(subtotal);
		const createdAt = input.now.toISOString();
		const expiresAt = new Date(input.now.getTime() + input.paymentTimeoutMinutes * 60_000).toISOString();

		db.prepare(
			`INSERT INTO orders (code, status, customer_name, customer_phone, address, city, lat, lng, courier, delivery_date, subtotal_idr, total_idr, note, created_at, expires_at)
			 VALUES (?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				input.code,
				input.customerName,
				input.customerPhone,
				input.address,
				input.city,
				input.lat,
				input.lng,
				input.courier,
				input.deliveryDate,
				subtotal,
				total,
				input.note,
				createdAt,
				expiresAt
			)
			.run();

		const order = db.prepare('SELECT id FROM orders WHERE code = ?').bind(input.code).get<{ id: number }>();
		if (!order) {
			throw new Error('Pesanan gagal disimpan');
		}
		for (const snapshot of snapshots) {
			db.prepare(
				'INSERT INTO order_items (order_id, variant_id, name_snapshot, price_snapshot, qty) VALUES (?, ?, ?, ?, ?)'
			)
				.bind(order.id, snapshot.variantId, snapshot.name, snapshot.priceIdr, snapshot.qty)
				.run();
		}
		db.prepare(
			"INSERT INTO payments (order_id, invoice_number, checkout_url, status, created_at) VALUES (?, ?, NULL, 'pending', ?)"
		)
			.bind(order.id, input.code, createdAt)
			.run();

		db.exec('COMMIT');
		return { ok: true, code: input.code, totalIdr: total };
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
}

export interface OrderItemView {
	name: string;
	priceIdr: number;
	qty: number;
}

export interface OrderDetail {
	code: string;
	status: OrderStatus;
	customerName: string;
	customerPhone: string;
	address: string;
	city: string;
	lat: number;
	lng: number;
	courier: string;
	deliveryDate: string;
	subtotalIdr: number;
	totalIdr: number;
	note: string | null;
	createdAt: string;
	expiresAt: string;
	paidAt: string | null;
	checkoutUrl: string | null;
	items: OrderItemView[];
}

function orderDetailFromRow(row: OrderRow): OrderDetail {
	const items = getDb()
		.prepare('SELECT name_snapshot, price_snapshot, qty FROM order_items WHERE order_id = ?')
		.bind(row.id)
		.all<{ name_snapshot: string; price_snapshot: number; qty: number }>();
	const payment = getDb()
		.prepare('SELECT checkout_url FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1')
		.bind(row.id)
		.get<{ checkout_url: string | null }>();
	return {
		code: row.code,
		status: row.status,
		customerName: row.customer_name,
		customerPhone: row.customer_phone,
		address: row.address,
		city: row.city,
		lat: row.lat,
		lng: row.lng,
		courier: row.courier,
		deliveryDate: row.delivery_date,
		subtotalIdr: row.subtotal_idr,
		totalIdr: row.total_idr,
		note: row.note,
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		paidAt: row.paid_at,
		checkoutUrl: payment?.checkout_url ?? null,
		items
	};
}

export function getOrderByCode(code: string): OrderDetail | null {
	const row = getDb().prepare('SELECT * FROM orders WHERE code = ?').bind(code).get<OrderRow>();
	return row ? orderDetailFromRow(row) : null;
}

// FR-15: lacak hanya cocok dengan kode + 4 digit terakhir WhatsApp.
export function findOrderByCodeAndPhoneTail(code: string, phoneTail: string): OrderDetail | null {
	const row = getDb()
		.prepare("SELECT * FROM orders WHERE code = ? AND customer_phone LIKE '%' || ?")
		.bind(code, phoneTail)
		.get<OrderRow>();
	return row ? orderDetailFromRow(row) : null;
}

export function saveCheckoutUrl(code: string, checkoutUrl: string): void {
	getDb()
		.prepare('UPDATE payments SET checkout_url = ? WHERE invoice_number = ? AND checkout_url IS NULL')
		.bind(checkoutUrl, code)
		.run();
}

// FR-12: status berubah sekali walau notifikasi datang berulang.
export function markPaidByInvoice(invoiceNumber: string, now: Date): boolean {
	const db = getDb();
	const changed = db
		.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE code = ? AND status = 'pending_payment'")
		.bind(now.toISOString(), invoiceNumber)
		.run();
	if (changed.changes === 1) {
		db.prepare("UPDATE payments SET status = 'success' WHERE invoice_number = ?").bind(invoiceNumber).run();
		return true;
	}
	return false;
}

export function recordWebhookEvent(requestId: string, now: Date): boolean {
	const result = getDb()
		.prepare('INSERT OR IGNORE INTO webhook_events (request_id, received_at) VALUES (?, ?)')
		.bind(requestId, now.toISOString())
		.run();
	return result.changes === 1;
}

// FR-13: pesanan melewati batas waktu menjadi kedaluwarsa dan stok kembali.
export function expireStaleOrders(now: Date): number {
	const db = getDb();
	const stale = db
		.prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND expires_at <= ?")
		.bind(now.toISOString())
		.all<{ id: number }>();
	if (stale.length === 0) {
		return 0;
	}
	db.exec('BEGIN');
	try {
		for (const order of stale) {
			const items = db
				.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?')
				.bind(order.id)
				.all<{ variant_id: number; qty: number }>();
			for (const item of items) {
				db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?')
					.bind(item.qty, item.variant_id)
					.run();
			}
			db.prepare("UPDATE orders SET status = 'expired' WHERE id = ?").bind(order.id).run();
		}
		db.exec('COMMIT');
		return stale.length;
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
}

// BR-04: jumlah pesanan aktif per tanggal kirim.
export function bookedCounts(): Record<string, number> {
	const rows = getDb()
		.prepare(
			"SELECT delivery_date, COUNT(*) AS n FROM orders WHERE status NOT IN ('expired', 'cancelled') GROUP BY delivery_date"
		)
		.bind()
		.all<{ delivery_date: string; n: number }>();
	const counts: Record<string, number> = {};
	for (const row of rows) {
		counts[row.delivery_date] = row.n;
	}
	return counts;
}

export function newCode(): string {
	return generateOrderCode((n) => crypto.getRandomValues(new Uint8Array(n)));
}
