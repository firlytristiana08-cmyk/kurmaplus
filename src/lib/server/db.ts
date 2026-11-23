// Akses data (PRD: Model data — database Supabase/Postgres). Domain memakai
// SQL yang sama di atas dua driver: Postgres Supabase (dipakai bila kredensial
// tersedia) dan node:sqlite lokal (fallback pengembangan; skema dan datanya
// sama). Placeholder ditulis `?` dan diterjemahkan ke `$n` untuk Postgres.
//
// Catatan Cloudflare Workers: modul bawaan Node (node:sqlite, node:fs, node:dns)
// diimpor MALAS (dynamic import) di jalur yang memakainya saja, agar modul ini
// tetap bisa dimuat di runtime Workers yang tidak menyediakan node:sqlite.

import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient, types } from "pg";
import { denganVersi } from "../foto-versi";
import { ensureRuntimeEnv, hyperdriveConnectionString } from "./cf-env";
import { MIGRASI } from "./migrasi";
import type { OrderStatus } from "./orders";
import { generateOrderCode } from "./orders";
import { subtotalIdr, totalIdr } from "./pricing";

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

// Galat koneksi PostgreSQL tidak boleh lolos ke EventEmitter sebagai galat tak
// tertangkap — di workerd satu galat tak tertangkap mematikan seluruh isolate
// (Error 1101). Ubah menjadi galat promise biasa yang bisa ditangani pemanggil.
function reportPgError(error: unknown): never {
  const code = (error as { code?: string }).code ?? (error as Error).name;
  process.stderr.write(`KURMAPLUS: kueri PostgreSQL gagal (${code}).\n`);
  throw error;
}

async function pgAll<T>(client: Pool | PoolClient, sql: string, params: SqlValue[]): Promise<T[]> {
  await ensureRuntimeEnv();
  const result = await client
    .query(toPostgresPlaceholders(sql), params as unknown[])
    .catch(reportPgError);
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
  await ensureRuntimeEnv();
  const result = await client
    .query(toPostgresPlaceholders(sql), params as unknown[])
    .catch(reportPgError);
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

export interface PostgresTarget {
  url: string;
  viaHyperdrive: boolean;
}

// Urutan pemilihan koneksi Postgres (fungsi murni agar mudah diuji):
// 1. Hyperdrive (Cloudflare Workers) — koneksi lokal ke layanan pool+cache.
// 2. DATABASE_URL / SUPABASE_DB_URL — URL eksplisit.
// 3. SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD — pooler Supabase.
export function pickPostgresUrl(input: {
  hyperdrive?: string | undefined;
  databaseUrl?: string | undefined;
  supabaseDbUrl?: string | undefined;
  projectRef?: string | undefined;
  password?: string | undefined;
  region?: string | undefined;
}): PostgresTarget | null {
  const hyperdrive = cleanEnv(input.hyperdrive);
  if (hyperdrive) {
    return { url: hyperdrive, viaHyperdrive: true };
  }
  const url = cleanEnv(input.databaseUrl ?? input.supabaseDbUrl);
  if (url) {
    return { url, viaHyperdrive: false };
  }
  const ref = cleanEnv(input.projectRef);
  const password = cleanEnv(input.password);
  if (ref && password) {
    // Password boleh mengandung karakter khusus; percent-encode agar URL
    // koneksi tidak rusak (driver pg akan decode kembali sebelum menyambung).
    //
    // Koneksi langsung `db.<ref>.supabase.co` me-resolve ke alamat IPv6 yang
    // tidak dapat dijangkau dari jaringan serverless (ENETUNREACH). Pooler
    // Supabase adalah jalur serverless yang didukung (IPv4); mode sesi
    // (port 5432) menjaga perilaku prepared statement seperti koneksi
    // langsung. Jalur diverifikasi lewat `DB_CHECK` di log build — lihat
    // scripts/check-db.mjs.
    const region = cleanEnv(input.region) || "ap-southeast-1";
    return {
      url: `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
      viaHyperdrive: false,
    };
  }
  return null;
}

function resolveConnection(): PostgresTarget | null {
  loadLocalEnv();
  return pickPostgresUrl({
    hyperdrive: hyperdriveConnectionString() ?? undefined,
    databaseUrl: process.env.DATABASE_URL,
    supabaseDbUrl: process.env.SUPABASE_DB_URL,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    password: process.env.SUPABASE_DB_PASSWORD,
    region: process.env.SUPABASE_REGION,
  });
}

function applyMigrations(raw: DatabaseSync): void {
  // Pelacak migrasi: berkas di db/migrations dijalankan sekali per database,
  // sehingga ALTER TABLE pada migrasi berikutnya aman dijalankan berulang kali.
  raw.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  // Sumber migrasi = modul MIGRASI, bukan folder di disk: bundel produksi tidak
  // memuat db/migrations (lihat kepala src/lib/server/migrasi.ts).
  for (const { name: file, statements } of MIGRASI) {
    const done = sqliteGet<{ ok: number }>(
      raw,
      "SELECT 1 AS ok FROM schema_migrations WHERE name = ?",
      [file],
    );
    if (done) continue;
    for (const pernyataan of statements) raw.exec(pernyataan);
    sqliteRun(raw, "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)", [
      file,
      new Date().toISOString(),
    ]);
  }
}

async function openSqlite(): Promise<Db> {
  // Modul bawaan Node hanya diimpor di jalur ini (pengembangan lokal); runtime
  // Cloudflare Workers tidak menyediakan node:sqlite dan tidak pernah ke sini.
  const [{ DatabaseSync }, fs] = await Promise.all([import("node:sqlite"), import("node:fs")]);
  // KURMAPLUS_DATA_DIR hanya untuk pengujian; produksi memakai .data.
  const dataDir = process.env.KURMAPLUS_DATA_DIR ?? path.join(process.cwd(), ".data");
  fs.mkdirSync(dataDir, { recursive: true });
  const raw = new DatabaseSync(path.join(dataDir, "kurmaplus.db"));
  applyMigrations(raw);
  const seeded = sqliteGet<{ n: number }>(raw, "SELECT COUNT(*) AS n FROM products", []);
  if ((seeded?.n ?? 0) === 0) {
    raw.exec(fs.readFileSync(path.join(process.cwd(), "db/seed.sql"), "utf8"));
  }
  // Data demo (pesanan contoh) hanya untuk pengembangan/preview lokal — lihat
  // db/seed-demo.sql. Jalur Postgres/Supabase tidak pernah menjalankan ini.
  const demoSeeded = sqliteGet<{ n: number }>(raw, "SELECT COUNT(*) AS n FROM orders", []);
  if ((demoSeeded?.n ?? 0) === 0) {
    raw.exec(fs.readFileSync(path.join(process.cwd(), "db/seed-demo.sql"), "utf8"));
    raw.exec(fs.readFileSync(path.join(process.cwd(), "db/seed-demo-admin.sql"), "utf8"));
  }
  // Produk dari berkas seed bisa masuk SETELAH migrasi 0010 berjalan. Saat
  // galeri masih kosong sama sekali, salin foto kolom lama ke product_photos
  // (idempoten; dijaga agar foto yang sengaja dihapus admin tidak hidup lagi).
  const galleryEmpty = sqliteGet<{ n: number }>(
    raw,
    "SELECT COUNT(*) AS n FROM product_photos",
    [],
  );
  if ((galleryEmpty?.n ?? 0) === 0) {
    raw.exec(`
      INSERT INTO product_photos (product_id, sort_order, data)
        SELECT id, 0, photo FROM products WHERE photo IS NOT NULL AND photo <> '';
      INSERT INTO product_photos (product_id, sort_order, data)
        SELECT id, 1, photo_2 FROM products WHERE photo_2 IS NOT NULL AND photo_2 <> '';
      INSERT INTO product_photos (product_id, sort_order, data)
        SELECT id, 2, photo_3 FROM products WHERE photo_3 IS NOT NULL AND photo_3 <> '';
    `);
  }
  return new SqliteDb(raw);
}

/**
 * Jalankan migrasi db/migrations untuk Postgres.
 *
 * Sebelum ini applyMigrations() HANYA dipanggil di jalur SQLite, sehingga
 * database produksi (Supabase) tidak pernah menerima migrasi apa pun —
 * perubahan skema bergantung pada langkah manual yang mudah terlewat.
 *
 * Perbedaan penting dari versi SQLite:
 * - Pelacak schema_migrations dipakai juga di sini, jadi tiap berkas cukup
 *   sekali berlaku.
 * - `ALTER TABLE ... ADD COLUMN` TIDAK memakai IF NOT EXISTS (SQLite menolak
 *   sintaks itu). Kolom diperiksa lebih dulu, lalu ALTER dijalankan hanya bila
 *   perlu. Galat "sudah ada" (42701) tetap ditelan sebagai jaring pengaman.
 * - Satu berkas yang gagal TIDAK menghentikan aplikasi. Migrasi dicatat di
 *   stderr lalu dilewati; situs tetap hidup dengan skema sebelumnya. Lebih
 *   buruk mematikan seluruh toko karena satu berkas migrasi bermasalah.
 */
async function applyMigrationsPostgres(pool: Pool): Promise<void> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  // Sumber migrasi = modul MIGRASI yang ikut ke bundel Worker. Versi sebelumnya
  // membaca db/migrations dari disk; folder itu tidak ada di bundel, sehingga
  // setiap penerapan migrasi di produksi berhenti diam-diam dan skema Supabase
  // tidak pernah berubah.
  for (const { name: file, statements } of MIGRASI) {
    try {
      const sudah = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (sudah.rowCount) continue;
      for (const satu of statements) {
        // "ADD COLUMN IF NOT EXISTS" hanya sah di Postgres; SQLite menolaknya.
        // Di sini klausa itu dibuang dan keberadaan kolom diperiksa lebih dulu.
        const tambahKolom = /^ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)/i.exec(
          satu,
        );
        if (tambahKolom) {
          const [, tabel, kolom] = tambahKolom;
          const ada = await pool.query(
            "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
            [tabel, kolom],
          );
          if (ada.rowCount) continue;
          await pool.query(satu.replace(/ADD COLUMN\s+IF NOT EXISTS/i, "ADD COLUMN"));
          continue;
        }
        await pool.query(satu);
      }
      await pool.query("INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)", [
        file,
        new Date().toISOString(),
      ]);
    } catch (error) {
      // Kode 42701 = kolom sudah ada; dianggap beres.
      const kode = (error as { code?: string }).code;
      if (kode === "42701") continue;
      // Satu berkas gagal tidak boleh mematikan toko. Kode galat saja (tanpa
      // pesan SQL) supaya tidak ada data yang bocor ke log.
      process.stderr.write(
        `KURMAPLUS: migrasi ${file} dilewati (${kode ?? (error as Error).name}).\n`,
      );
    }
  }
}

async function openPostgres(target: PostgresTarget): Promise<Db> {
  // Host Supabase me-resolve ke IPv6 lebih dulu, sedangkan jaringan serverless
  // tidak selalu memiliki jalur IPv6 (galat ENETUNREACH). Resolusi DNS dipaksa
  // mendahulukan IPv4 bila runtime menyediakan node:dns (Vercel/lokal); di
  // Cloudflare Workers resolusi mengikuti bawaan runtime.
  try {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  } catch {
    /* runtime tanpa node:dns — tidak masalah */
  }
  const pool = new Pool({
    connectionString: target.url,
    max: 4,
    connectionTimeoutMillis: 5_000,
    // Workers tidak boleh memakai satu koneksi lintas request ("Cannot perform
    // I/O on behalf of a different request"): koneksi yang sudah sekali dipakai
    // dipensiunkan sehingga request berikutnya mengambil koneksi segar dari pool
    // Hyperdrive. Tanpa ini katalog hidup pada request pertama lalu 500 pada
    // request berikutnya di isolate yang sama.
    maxUses: 1,
    // Hyperdrive sudah menangani TLS ke Supabase dari sisinya; koneksi lokal ke
    // Hyperdrive tidak memakai SSL. Koneksi langsung ke pooler memakai TLS
    // longgar seperti sebelumnya.
    ...(target.viaHyperdrive ? {} : { ssl: { rejectUnauthorized: false } }),
    // Koneksi diam yang diputus server memancarkan 'error'; tanpa penanganan,
    // EventEmitter melempar galat tak tertangkap dan seluruh isolate Worker
    // mati (Error 1101). Catat saja — pool akan membuka koneksi baru.
    ...(target.viaHyperdrive
      ? {
          onError: (error: Error) => {
            process.stderr.write(`KURMAPLUS: koneksi PostgreSQL terputus (${error.message}).\n`);
          },
        }
      : {}),
  });
  try {
    await pool.query("SELECT 1");
    // Migrasi dijalankan setelah koneksi terbukti, sebelum query pertama
    // aplikasi — supaya skema sudah mutakhir saat halaman meminta data.
    await applyMigrationsPostgres(pool);
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
  // Muat env runtime workerd (binding Hyperdrive) sebelum memilih koneksi.
  await ensureRuntimeEnv();
  const target = resolveConnection();
  if (mode === "sqlite" || (mode === "auto" && target === null)) {
    return openSqlite();
  }
  if (target === null) {
    throw new Error("KURMAPLUS_DB=supabase tetapi tidak ada DATABASE_URL/SUPABASE_PROJECT_REF");
  }
  if (mode === "supabase") {
    return openPostgres(target);
  }
  // auto: utamakan Supabase; di luar produksi jatuh ke database lokal bila
  // jaringan tidak menjangkau Supabase (pratinjau sandbox).
  try {
    return await openPostgres(target);
  } catch (error) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.CF_PAGES) {
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
    // Kegagalan tidak boleh ter-cache: promise yang sudah ditolak akan membuat
    // setiap request berikutnya di isolate yang sama ikut gagal (gejala katalog
    // hidup lalu hilang terus-menerus). Buang lalu coba lagi pada request
    // berikutnya.
    instance = createDb().catch((error: unknown) => {
      instance = null;
      throw error;
    });
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
  photos: { id: number; src: string; versi: number }[];
  isBestSeller: boolean;
  variants: VariantView[];
  minPriceIdr: number;
  allOutOfStock: boolean;
}

// Sumber foto lewat endpoint /api/foto/{id} — URL data tidak disematkan di
// HTML, halaman tetap ringan dan browser bisa menyimpan foto di cache.
export const photoApiSrc = (photoId: number, versi?: number): string =>
  denganVersi(`/api/foto/${photoId}`, versi);

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
    "SELECT id, product_id, label, weight_grams, price_idr, stock FROM variants WHERE product_id = ? AND is_active = 1 ORDER BY weight_grams",
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
  is_best_seller: number;
}

/**
 * Jalankan kueri yang menyebut kolom `version`, dengan cadangan tanpa kolom itu.
 *
 * Kolom `version` baru ada setelah migrasi 0012 berlaku. Bila migrasi itu
 * belum berjalan (mis. deploy mendahului migrasi, atau migrasi dilewati),
 * kueri yang menyebutnya akan galat dan penjualan berhenti total. Cadangan ini
 * membuat foto tetap tampil — hanya tanpa versi — sampai migrasi menyusul.
 */
async function denganKolomVersi<T>(jalankan: (sebutVersi: boolean) => Promise<T>): Promise<T> {
  try {
    return await jalankan(true);
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "";
    // Postgres: kolom tidak ada (42703). SQLite: "no such column".
    const kode = (error as { code?: string }).code;
    if (kode === "42703" || /no such column/i.test(pesan)) {
      return jalankan(false);
    }
    throw error;
  }
}

async function photosOf(
  db: Db,
  productId: number,
): Promise<{ id: number; src: string; versi: number }[]> {
  const rows = await denganKolomVersi((sebutVersi) =>
    db.all<{ id: number; version: number | null }>(
      sebutVersi
        ? "SELECT id, version FROM product_photos WHERE product_id = ? ORDER BY sort_order, id"
        : "SELECT id FROM product_photos WHERE product_id = ? ORDER BY sort_order, id",
      [productId],
    ),
  );
  // Versi ikut ke URL supaya cache lama tidak menahan foto yang sudah diganti.
  return rows.map((row) => ({
    id: row.id,
    src: photoApiSrc(row.id, row.version ?? 1),
    versi: row.version ?? 1,
  }));
}

function buildProductView(
  row: ProductRow,
  variants: VariantView[],
  photos: { id: number; src: string; versi: number }[],
): ProductView {
  const prices = variants.map((variant) => variant.priceIdr);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    photos,
    isBestSeller: row.is_best_seller === 1,
    variants,
    minPriceIdr: prices.length > 0 ? Math.min(...prices) : 0,
    allOutOfStock: variants.every((variant) => variant.stock <= 0),
  };
}

async function toProductView(db: Db, row: ProductRow): Promise<ProductView> {
  return buildProductView(row, await variantsOf(db, row.id), await photosOf(db, row.id));
}

export async function listProducts(): Promise<ProductView[]> {
  const db = await getDb();
  const rows = await db.all<ProductRow>(
    "SELECT id, slug, name, description, is_best_seller FROM products WHERE is_active = 1 ORDER BY sort_order",
  );
  if (rows.length === 0) return [];
  // Varian & foto semua produk diambil sekali (bukan per produk) — katalog
  // tetap cepat walau jumlah produk bertambah.
  const variantRows = await db.all<VariantRow>(
    "SELECT id, product_id, label, weight_grams, price_idr, stock FROM variants WHERE is_active = 1 ORDER BY weight_grams",
  );
  const photoRows = await denganKolomVersi((sebutVersi) =>
    db.all<{ id: number; product_id: number; version: number | null }>(
      sebutVersi
        ? "SELECT id, product_id, version FROM product_photos ORDER BY product_id, sort_order, id"
        : "SELECT id, product_id FROM product_photos ORDER BY product_id, sort_order, id",
    ),
  );
  return rows.map((row) =>
    buildProductView(
      row,
      variantRows
        .filter((variant) => variant.product_id === row.id)
        .map((variant) => ({
          id: variant.id,
          label: variant.label,
          weightGrams: variant.weight_grams,
          priceIdr: variant.price_idr,
          stock: variant.stock,
        })),
      photoRows
        .filter((photo) => photo.product_id === row.id)
        .map((photo) => ({
          id: photo.id,
          src: photoApiSrc(photo.id, photo.version ?? 1),
          versi: photo.version ?? 1,
        })),
    ),
  );
}

// Jumlah terjual per produk (pesanan berstatus lunas s/d selesai) — untuk
// label "Best seller" dan angka "Terjual" di katalog.
export async function productSoldCounts(): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db.all<{ product_id: number; sold: number | string }>(
    `SELECT v.product_id AS product_id, SUM(oi.qty) AS sold FROM order_items oi JOIN variants v ON v.id = oi.variant_id JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('paid', 'packed', 'shipped', 'done') GROUP BY v.product_id`,
    [],
  );
  return new Map(rows.map((row) => [row.product_id, Number(row.sold)]));
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const db = await getDb();
  const row = await db.get<ProductRow>(
    "SELECT id, slug, name, description, is_best_seller FROM products WHERE slug = ? AND is_active = 1",
    [slug],
  );
  return row ? toProductView(db, row) : null;
}

export interface CreateOrderInput {
  code: string;
  customerName: string;
  customerPhone: string;
  email?: string | null;
  address: string;
  city: string;
  lat: number;
  lng: number;
  courier: "COD" | "Grab" | "Gojek";
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
  email: string | null;
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
          "SELECT v.id, v.label, v.stock, v.price_idr, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = 1",
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
        `INSERT INTO orders (code, status, customer_name, customer_phone, email, address, city, lat, lng, courier, delivery_date, subtotal_idr, total_idr, note, created_at, expires_at)
				 VALUES (?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.code,
          input.customerName,
          input.customerPhone,
          input.email ?? null,
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
        // PRD Portal Admin: penguncian stok meninggalkan baris stock_movements.
        // Dicatat SETELAH order.id diketahui supaya jejak stok bisa ditelusuri
        // ke pesanannya (sebelumnya order_id selalu NULL).
        await tx.run(
          "INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, actor, created_at) VALUES (?, ?, ?, 'lock_order', ?, 'sistem', ?)",
          [crypto.randomUUID(), snapshot.variantId, -snapshot.qty, order.id, createdAt],
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
  email: string | null;
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
    email: row.email,
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
    // PRD Portal Admin: perubahan status tercatat di log audit (pelaku sistem).
    await db.run(
      "INSERT INTO audit_log (id, actor, entity, entity_id, action, before_json, after_json, created_at) VALUES (?, 'sistem', 'order', ?, 'status_changed', ?, ?, ?)",
      [
        crypto.randomUUID(),
        invoiceNumber,
        JSON.stringify({ status: "pending_payment" }),
        JSON.stringify({ status: "paid", source: "doku" }),
        now.toISOString(),
      ],
    );
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

interface ExpirableOrder {
  id: number;
  code: string;
}

// Satu pesanan menunggu bayar ditutup: stok kembali + catatan audit sistem.
async function expireOrderTx(tx: Db, order: ExpirableOrder, now: Date): Promise<void> {
  const items = await tx.all<{ variant_id: number; qty: number }>(
    "SELECT variant_id, qty FROM order_items WHERE order_id = ?",
    [order.id],
  );
  for (const item of items) {
    await tx.run("UPDATE variants SET stock = stock + ? WHERE id = ?", [item.qty, item.variant_id]);
    // PRD Portal Admin: pengembalian stok dicatat di stock_movements.
    await tx.run(
      "INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, actor, created_at) VALUES (?, ?, ?, 'expire_return', ?, 'sistem', ?)",
      [crypto.randomUUID(), item.variant_id, item.qty, order.id, now.toISOString()],
    );
  }
  await tx.run("UPDATE orders SET status = 'expired' WHERE id = ?", [order.id]);
  // PRD Portal Admin: aksi sistem dicatat di log audit.
  await tx.run(
    "INSERT INTO audit_log (id, actor, entity, entity_id, action, before_json, after_json, created_at) VALUES (?, 'sistem', 'order', ?, 'order_expired', ?, ?, ?)",
    [
      crypto.randomUUID(),
      order.code,
      JSON.stringify({ status: "pending_payment" }),
      JSON.stringify({ status: "expired" }),
      now.toISOString(),
    ],
  );
}

// FR-13: pesanan melewati batas waktu menjadi kedaluwarsa dan stok kembali.
export async function expireStaleOrders(now: Date): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const stale = await tx.all<ExpirableOrder>(
      "SELECT id, code FROM orders WHERE status = 'pending_payment' AND expires_at <= ?",
      [now.toISOString()],
    );
    for (const order of stale) {
      await expireOrderTx(tx, order, now);
    }
    return stale.length;
  });
}

// Notifikasi kedaluwarsa dari DOKU (sejalan dengan email ke pembeli): tutup
// pesanan yang masih menunggu bayar. Pesanan yang sudah lunas tidak pernah
// diturunkan statusnya.
export async function expireOrderByInvoice(invoiceNumber: string, now: Date): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const order = await tx.get<ExpirableOrder>(
      "SELECT id, code FROM orders WHERE code = ? AND status = 'pending_payment'",
      [invoiceNumber],
    );
    if (!order) return false;
    await expireOrderTx(tx, order, now);
    return true;
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
