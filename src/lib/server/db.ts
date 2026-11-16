// Akses data (PRD: Model data — database Supabase/Postgres). Domain memakai
// SQL yang sama di atas dua driver: Postgres Supabase (dipakai bila kredensial
// tersedia) dan node:sqlite lokal (fallback pengembangan; skema dan datanya
// sama). Placeholder ditulis `?` dan diterjemahkan ke `$n` untuk Postgres.

import { setDefaultResultOrder } from "node:dns";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient, types } from "pg";
import type { OrderStatus } from "./orders";
import { generateOrderCode } from "./orders";
import { subtotalIdr, totalIdr } from "./pricing";

// Host Supabase me-resolve ke IPv6 lebih dulu, sedangkan jaringan serverless
// (Vercel) tidak selalu memiliki jalur IPv6 (galat ENETUNREACH). Resolusi DNS
// dipaksa mendahulukan IPv4 agar koneksi database selalu memakai jalur yang ada.
setDefaultResultOrder("ipv4first");

type SqlValue = string | number | bigint | null | Uint8Array;

export interface Db {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

// Hasil baca Postgres disamakan dengan SQLite: waktu menjadi string ISO,
// tanggal menjadi YYYY-MM-DD, dan bilangan besar menjadi number.
types.setTypeParser(1184, (value: string) => new Date(value).toISOString());
types.setTypeParser(1082, (value: string) => value);
types.setTypeParser(20, (value: string) => Number(value));

function toPostgresPlaceholders(sql: string): string {
  let out = "";
  let count = 0;
  let insideString = false;
  for (const char of sql) {
    if (char === "'") {
      insideString = !insideString;
    } else if (char === "?" && !insideString) {
      count += 1;
      out += `$${count}`;
      continue;
    }
    out += char;
  }
  return out;
}

// ---------- Driver: node:sqlite lokal ----------

function sqliteAll<T>(raw: DatabaseSync, sql: string, params: SqlValue[]): T[] {
  return raw.prepare(sql).all(...params) as T[];
}

function sqliteGet<T>(raw: DatabaseSync, sql: string, params: SqlValue[]): T | undefined {
  return raw.prepare(sql).get(...params) as T | undefined;
}

function sqliteRun(raw: DatabaseSync, sql: string, params: SqlValue[]): { changes: number } {
  const result = raw.prepare(sql).run(...params);
  return { changes: Number(result.changes) };
}

class SqliteTx implements Db {
  #raw: DatabaseSync;

  constructor(raw: DatabaseSync) {
    this.#raw = raw;
  }

  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return Promise.resolve(sqliteAll<T>(this.#raw, sql, params));
  }

  get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    return Promise.resolve(sqliteGet<T>(this.#raw, sql, params));
  }

  run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    return Promise.resolve(sqliteRun(this.#raw, sql, params));
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

class SqliteDb implements Db {
  #raw: DatabaseSync;
  #queue: Promise<void> = Promise.resolve();

  constructor(raw: DatabaseSync) {
    this.#raw = raw;
  }

  // Antrean global: transaksi harus berjalan utuh tanpa kueri lain
  // menyelip di antara BEGIN dan COMMIT pada koneksi yang sama.
  #enqueue<T>(job: () => T | Promise<T>): Promise<T> {
    const result = this.#queue.then(() => job());
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.#enqueue(() => sqliteAll<T>(this.#raw, sql, params));
  }

  get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    return this.#enqueue(() => sqliteGet<T>(this.#raw, sql, params));
  }

  run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    return this.#enqueue(() => sqliteRun(this.#raw, sql, params));
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.#enqueue(async () => {
      this.#raw.exec("BEGIN");
      try {
        const result = await fn(new SqliteTx(this.#raw));
        this.#raw.exec("COMMIT");
        return result;
      } catch (error) {
        this.#raw.exec("ROLLBACK");
        throw error;
      }
    });
  }
}

// ---------- Driver: Postgres Supabase ----------

async function pgAll<T>(client: Pool | PoolClient, sql: string, params: SqlValue[]): Promise<T[]> {
  const result = await client.query(toPostgresPlaceholders(sql), params as unknown[]);
  return result.rows as T[];
}

async function pgGet<T>(
  client: Pool | PoolClient,
  sql: string,
  params: SqlValue[],
): Promise<T | undefined> {
  const rows = await pgAll<T>(client, sql, params);
  return rows[0];
}

async function pgRun(
  client: Pool | PoolClient,
  sql: string,
  params: SqlValue[],
): Promise<{ changes: number }> {
  const result = await client.query(toPostgresPlaceholders(sql), params as unknown[]);
  return { changes: result.rowCount ?? 0 };
}

class PostgresTx implements Db {
  #client: PoolClient;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return pgAll<T>(this.#client, sql, params);
  }

  get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    return pgGet<T>(this.#client, sql, params);
  }

  run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    return pgRun(this.#client, sql, params);
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

class PostgresDb implements Db {
  #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return pgAll<T>(this.#pool, sql, params);
  }

  get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    return pgGet<T>(this.#pool, sql, params);
  }

  run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    return pgRun(this.#pool, sql, params);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(new PostgresTx(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

// ---------- Pemilihan driver ----------

function loadLocalEnv(): void {
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_PROJECT_REF) {
    return;
  }
  // .dev.vars.local = rahasia pengembangan (masuk .gitignore), opsional ada.
  try {
    process.loadEnvFile(path.join(process.cwd(), ".dev.vars.local"));
  } catch {
    /* berkas tidak ada — pakai environment apa adanya */
  }
}

// Nilai env sering terbawa spasi atau kutip saat ditempel di panel hosting.
function cleanEnv(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.trim().replace(/^["']|["']$/g, "");
}

function connectionString(): string | null {
  loadLocalEnv();
  const url = cleanEnv(process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL);
  if (url) {
    return url;
  }
  const ref = cleanEnv(process.env.SUPABASE_PROJECT_REF);
  const password = cleanEnv(process.env.SUPABASE_DB_PASSWORD);
  if (ref && password) {
    // Password boleh mengandung karakter khusus; percent-encode agar URL
    // koneksi tidak rusak (driver pg akan decode kembali sebelum menyambung).
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
  }
  return null;
}

function openSqlite(): Db {
  // KURMAPLUS_DATA_DIR hanya untuk pengujian; produksi memakai .data.
  const dataDir = process.env.KURMAPLUS_DATA_DIR ?? path.join(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });
  const raw = new DatabaseSync(path.join(dataDir, "kurmaplus.db"));
  raw.exec(readFileSync(path.join(process.cwd(), "db/migrations/0001_init.sql"), "utf8"));
  const seeded = sqliteGet<{ n: number }>(raw, "SELECT COUNT(*) AS n FROM products", []);
  if ((seeded?.n ?? 0) === 0) {
    raw.exec(readFileSync(path.join(process.cwd(), "db/seed.sql"), "utf8"));
  }
  return new SqliteDb(raw);
}

async function openPostgres(url: string): Promise<Db> {
  const pool = new Pool({
    connectionString: url,
    max: 4,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    await pool.end().catch(() => undefined);
    // Kode galat saja (tanpa pesan/sandi) supaya mudah didiagnosis dari log
    // hosting: 28P01 = salah password, ENOTFOUND = salah SUPABASE_PROJECT_REF,
    // ETIMEDOUT/ECONNREFUSED = masalah jaringan.
    const code = (error as { code?: string }).code ?? (error as Error).name;
    process.stderr.write(
      `KURMAPLUS: koneksi database gagal (${code}) — periksa SUPABASE_PROJECT_REF dan SUPABASE_DB_PASSWORD.\n`,
    );
    throw error;
  }
  return new PostgresDb(pool);
}

let instance: Promise<Db> | null = null;

async function createDb(): Promise<Db> {
  const mode = process.env.KURMAPLUS_DB ?? "auto";
  const url = connectionString();
  if (mode === "sqlite" || (mode === "auto" && url === null)) {
    return openSqlite();
  }
  if (url === null) {
    throw new Error("KURMAPLUS_DB=supabase tetapi tidak ada DATABASE_URL/SUPABASE_PROJECT_REF");
  }
  if (mode === "supabase") {
    return openPostgres(url);
  }
  // auto: utamakan Supabase; di luar produksi jatuh ke database lokal bila
  // jaringan tidak menjangkau Supabase (pratinjau sandbox).
  try {
    return await openPostgres(url);
  } catch (error) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw error;
    }
    process.stderr.write(
      `KURMAPLUS: Supabase tidak terjangkau (${error instanceof Error ? error.message : "galat"}); memakai database lokal.\n`,
    );
    return openSqlite();
  }
}

export function getDb(): Promise<Db> {
  if (instance === null) {
    instance = createDb();
  }
  return instance;
}

// ---------- Lapisan domain ----------

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await (await getDb()).all<{ key: string; value: string }>(
    "SELECT key, value FROM settings",
  );
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

async function variantsOf(db: Db, productId: number): Promise<VariantView[]> {
  const rows = await db.all<VariantRow>(
    "SELECT id, product_id, label, weight_grams, price_idr, stock FROM variants WHERE product_id = ? AND is_active = TRUE ORDER BY weight_grams",
    [productId],
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    weightGrams: row.weight_grams,
    priceIdr: row.price_idr,
    stock: row.stock,
  }));
}

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  photo: string | null;
}

async function toProductView(db: Db, row: ProductRow): Promise<ProductView> {
  const variants = await variantsOf(db, row.id);
  const prices = variants.map((variant) => variant.priceIdr);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    photo: row.photo,
    variants,
    minPriceIdr: prices.length > 0 ? Math.min(...prices) : 0,
    allOutOfStock: variants.every((variant) => variant.stock <= 0),
  };
}

export async function listProducts(): Promise<ProductView[]> {
  const db = await getDb();
  const rows = await db.all<ProductRow>(
    "SELECT id, slug, name, description, photo FROM products WHERE is_active = TRUE ORDER BY sort_order",
  );
  const products: ProductView[] = [];
  for (const row of rows) {
    products.push(await toProductView(db, row));
  }
  return products;
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const db = await getDb();
  const row = await db.get<ProductRow>(
    "SELECT id, slug, name, description, photo FROM products WHERE slug = ? AND is_active = TRUE",
    [slug],
  );
  return row ? toProductView(db, row) : null;
}

export interface CreateOrderInput {
  code: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  courier: "Grab" | "Gojek";
  deliveryDate: string;
  note: string | null;
  items: { variantId: number; qty: number }[];
  now: Date;
  paymentTimeoutMinutes: number;
}

export type CreateOrderResult =
  | { ok: true; code: string; totalIdr: number }
  | { ok: false; reason: "stock"; variantId: number; requested: number; available: number };

class InsufficientStockError extends Error {
  result: CreateOrderResult;

  constructor(result: CreateOrderResult) {
    super("Stok tidak cukup");
    this.result = result;
  }
}

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
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = await getDb();
  try {
    return await db.transaction(async (tx) => {
      const lines: { priceIdr: number; qty: number }[] = [];
      const snapshots: { variantId: number; name: string; priceIdr: number; qty: number }[] = [];
      for (const item of input.items) {
        const variant = await tx.get<{
          id: number;
          label: string;
          stock: number;
          price_idr: number;
          product_name: string;
        }>(
          "SELECT v.id, v.label, v.stock, v.price_idr, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = TRUE",
          [item.variantId],
        );
        if (!variant || variant.stock < item.qty) {
          throw new InsufficientStockError({
            ok: false,
            reason: "stock",
            variantId: item.variantId,
            requested: item.qty,
            available: variant?.stock ?? 0,
          });
        }
        const locked = await tx.run(
          "UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?",
          [item.qty, item.variantId, item.qty],
        );
        if (locked.changes < 1) {
          throw new InsufficientStockError({
            ok: false,
            reason: "stock",
            variantId: item.variantId,
            requested: item.qty,
            available: 0,
          });
        }
        lines.push({ priceIdr: variant.price_idr, qty: item.qty });
        snapshots.push({
          variantId: item.variantId,
          name: `${variant.product_name} ${variant.label}`,
          priceIdr: variant.price_idr,
          qty: item.qty,
        });
      }

      const subtotal = subtotalIdr(lines);
      const total = totalIdr(subtotal);
      const createdAt = input.now.toISOString();
      const expiresAt = new Date(
        input.now.getTime() + input.paymentTimeoutMinutes * 60_000,
      ).toISOString();

      await tx.run(
        `INSERT INTO orders (code, status, customer_name, customer_phone, address, city, lat, lng, courier, delivery_date, subtotal_idr, total_idr, note, created_at, expires_at)
				 VALUES (?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
          expiresAt,
        ],
      );

      const order = await tx.get<{ id: number }>("SELECT id FROM orders WHERE code = ?", [
        input.code,
      ]);
      if (!order) {
        throw new Error("Pesanan gagal disimpan");
      }
      for (const snapshot of snapshots) {
        await tx.run(
          "INSERT INTO order_items (order_id, variant_id, name_snapshot, price_snapshot, qty) VALUES (?, ?, ?, ?, ?)",
          [order.id, snapshot.variantId, snapshot.name, snapshot.priceIdr, snapshot.qty],
        );
      }
      await tx.run(
        "INSERT INTO payments (order_id, invoice_number, checkout_url, status, created_at) VALUES (?, ?, NULL, 'pending', ?)",
        [order.id, input.code, createdAt],
      );
      return { ok: true as const, code: input.code, totalIdr: total };
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return error.result;
    }
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

async function orderDetailFromRow(db: Db, row: OrderRow): Promise<OrderDetail> {
  const items = (
    await db.all<{ name_snapshot: string; price_snapshot: number; qty: number }>(
      "SELECT name_snapshot, price_snapshot, qty FROM order_items WHERE order_id = ?",
      [row.id],
    )
  ).map((item) => ({ name: item.name_snapshot, priceIdr: item.price_snapshot, qty: item.qty }));
  const payment = await db.get<{ checkout_url: string | null }>(
    "SELECT checkout_url FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1",
    [row.id],
  );
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
    items,
  };
}

export async function getOrderByCode(code: string): Promise<OrderDetail | null> {
  const db = await getDb();
  const row = await db.get<OrderRow>("SELECT * FROM orders WHERE code = ?", [code]);
  return row ? orderDetailFromRow(db, row) : null;
}

// FR-15: lacak hanya cocok dengan kode + 4 digit terakhir WhatsApp.
export async function findOrderByCodeAndPhoneTail(
  code: string,
  phoneTail: string,
): Promise<OrderDetail | null> {
  const db = await getDb();
  const row = await db.get<OrderRow>(
    "SELECT * FROM orders WHERE code = ? AND customer_phone LIKE '%' || ?",
    [code, phoneTail],
  );
  return row ? orderDetailFromRow(db, row) : null;
}

export async function saveCheckoutUrl(code: string, checkoutUrl: string): Promise<void> {
  await (await getDb()).run(
    "UPDATE payments SET checkout_url = ? WHERE invoice_number = ? AND checkout_url IS NULL",
    [checkoutUrl, code],
  );
}

// FR-12: status berubah sekali walau notifikasi datang berulang.
export async function markPaidByInvoice(invoiceNumber: string, now: Date): Promise<boolean> {
  const db = await getDb();
  const changed = await db.run(
    "UPDATE orders SET status = 'paid', paid_at = ? WHERE code = ? AND status = 'pending_payment'",
    [now.toISOString(), invoiceNumber],
  );
  if (changed.changes === 1) {
    await db.run("UPDATE payments SET status = 'success' WHERE invoice_number = ?", [
      invoiceNumber,
    ]);
    return true;
  }
  return false;
}

export async function recordWebhookEvent(requestId: string, now: Date): Promise<boolean> {
  const result = await (await getDb()).run(
    "INSERT INTO webhook_events (request_id, received_at) VALUES (?, ?) ON CONFLICT (request_id) DO NOTHING",
    [requestId, now.toISOString()],
  );
  return result.changes === 1;
}

// FR-13: pesanan melewati batas waktu menjadi kedaluwarsa dan stok kembali.
export async function expireStaleOrders(now: Date): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const stale = await tx.all<{ id: number }>(
      "SELECT id FROM orders WHERE status = 'pending_payment' AND expires_at <= ?",
      [now.toISOString()],
    );
    if (stale.length === 0) {
      return 0;
    }
    for (const order of stale) {
      const items = await tx.all<{ variant_id: number; qty: number }>(
        "SELECT variant_id, qty FROM order_items WHERE order_id = ?",
        [order.id],
      );
      for (const item of items) {
        await tx.run("UPDATE variants SET stock = stock + ? WHERE id = ?", [
          item.qty,
          item.variant_id,
        ]);
      }
      await tx.run("UPDATE orders SET status = 'expired' WHERE id = ?", [order.id]);
    }
    return stale.length;
  });
}

// BR-04: jumlah pesanan aktif per tanggal kirim.
export async function bookedCounts(): Promise<Record<string, number>> {
  const rows = await (await getDb()).all<{ delivery_date: string; n: number }>(
    "SELECT delivery_date, COUNT(*) AS n FROM orders WHERE status NOT IN ('expired', 'cancelled') GROUP BY delivery_date",
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.delivery_date] = row.n;
  }
  return counts;
}

export function newCode(): string {
  return generateOrderCode((n) => crypto.getRandomValues(new Uint8Array(n)));
}
