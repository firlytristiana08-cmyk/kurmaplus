import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIGRASI, pisahPernyataan } from "./migrasi";

const DIR = path.join(process.cwd(), "db", "migrations");

describe("migrasi: modul MIGRASI adalah salinan setia berkas .sql", () => {
  it("memuat SEMUA berkas migrasi, tidak ada yang tertinggal", () => {
    const diDisk = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(MIGRASI.map((m) => m.name)).toEqual(diDisk);
  });

  it("setiap pernyataan sama persis dengan isi berkasnya", () => {
    // Salinan yang menyimpang berarti SQLite lokal dan Supabase produksi
    // menjalankan skema berbeda — persis kelas bug yang membuat modul ini ada.
    for (const { name, statements } of MIGRASI) {
      const isi = readFileSync(path.join(DIR, name), "utf8");
      expect(statements, `isi ${name} menyimpang dari db/migrations/${name}`).toEqual(
        pisahPernyataan(isi),
      );
    }
  });

  it("tidak ada pernyataan yang memuat lebih dari satu SQL", () => {
    // Pelari Postgres menjalankan satu pernyataan per pool.query(); sisipan ';'
    // di dalam string literal akan memecahnya dan membuat migrasi gagal.
    for (const { name, statements } of MIGRASI) {
      for (const s of statements) {
        expect(s.replace(/--[^\n]*/g, "").includes(";"), `${name}: ${s.slice(0, 40)}`).toBe(false);
      }
    }
  });
});

/** Jalankan semua migrasi di database SQLite baru, seperti openSqlite(). */
function jalankan(db: DatabaseSync) {
  for (const { name, statements } of MIGRASI) {
    const ada = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(name);
    if (ada) continue;
    for (const s of statements) db.exec(s);
    db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(name, "x");
  }
}

function siapkan() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  return db;
}

describe("migrasi: berjalan di database kosong dan aman diulang", () => {
  it("semua migrasi berjalan berurutan tanpa galat", () => {
    const db = siapkan();
    expect(() => jalankan(db)).not.toThrow();
    // Bukti bahwa migrasi foto benar-benar mendarat:
    const kolom = db
      .prepare(
        "SELECT COUNT(*) AS n FROM pragma_table_info('product_photos') WHERE name = 'version'",
      )
      .get() as { n: number };
    expect(kolom.n).toBe(1);
    expect(db.prepare("SELECT next_id FROM product_photo_seq WHERE id = 1").get()).toBeTruthy();
  });

  it("dijalankan dua kali tidak menduplikasi apa pun", () => {
    const db = siapkan();
    jalankan(db);
    const sebelum = db.prepare("SELECT COUNT(*) AS n FROM product_photos").get() as { n: number };
    expect(() => jalankan(db)).not.toThrow();
    const sesudah = db.prepare("SELECT COUNT(*) AS n FROM product_photos").get() as { n: number };
    expect(sesudah.n).toBe(sebelum.n);
  });
});

describe("migrasi 0010: penjaga duplikasi galeri", () => {
  // Migrasi 0010 menyalin kolom photo/photo_2/photo_3 ke product_photos.
  // Tiga INSERT ... SELECT itu awalnya TANPA penjaga, sehingga menjalankannya
  // pada database yang galerinya sudah terisi MENGGANDAKAN setiap foto.
  // Di produksi berkas ini sempat tercatat "sudah jalan" hanya berdasarkan
  // keberadaan kolom, bukan isi datanya — jadi penjaganya wajib ada.

  it("produk yang sudah punya foto TIDAK disalin ulang", () => {
    const db = siapkan();
    jalankan(db);
    // Produk dengan tiga kolom foto lama terisi (kondisi sebelum migrasi 0010).
    db.exec(
      "INSERT INTO products (id, slug, name, description, photo, photo_2, photo_3) VALUES (1, 'a', 'A', 'x', '/a.webp', '/b.webp', '/c.webp')",
    );
    db.prepare("DELETE FROM schema_migrations WHERE name = '0010_product_photos.sql'").run();

    jalankan(db);
    const awal = db.prepare("SELECT COUNT(*) AS n FROM product_photos").get() as { n: number };
    expect(awal.n, "tiga kolom foto tersalin sekali").toBe(3);

    // Jalankan ULANG berkas 0010 secara paksa (meniru pelacak yang hilang, atau
    // database yang galerinya sudah terisi lewat jalur lain).
    db.prepare("DELETE FROM schema_migrations WHERE name = '0010_product_photos.sql'").run();
    jalankan(db);
    const akhir = db.prepare("SELECT COUNT(*) AS n FROM product_photos").get() as { n: number };
    expect(akhir.n, "foto lama tersalin lagi = galeri berisi foto kembar").toBe(3);
  });

  it("produk tanpa foto lama tetap mendapat galeri kosong", () => {
    const db = siapkan();
    jalankan(db);
    db.exec("INSERT INTO products (id, slug, name, description) VALUES (1, 'a', 'A', 'x')");
    db.prepare("DELETE FROM schema_migrations WHERE name = '0010_product_photos.sql'").run();
    jalankan(db);
    const n = db.prepare("SELECT COUNT(*) AS n FROM product_photos").get() as { n: number };
    expect(n.n).toBe(0);
  });
});
