// Pemeriksaan koneksi database saat build (prebuild): hanya mencetak kode
// galat (tanpa pesan/sandi) ke log build agar mudah didiagnosis dari luar.
// Selalu exit 0 — pemeriksaan tidak boleh menggagalkan build.

import { Client } from "pg";

const ref = (process.env.SUPABASE_PROJECT_REF ?? "").trim();
const password = (process.env.SUPABASE_DB_PASSWORD ?? "")
	.trim()
	.replace(/^["']|["']$/g, "");
const url =
	(process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "").trim() ||
	(ref && password
		? `postgresql://postgres.${ref}:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
		: "");

if (!url) {
	process.stdout.write(`DB_CHECK ref=${ref || "-"} code=NO_ENV\n`);
	process.exit(0);
}

const client = new Client({
	connectionString: url,
	ssl: { rejectUnauthorized: false },
	connectionTimeoutMillis: 8_000,
});

try {
	await client.connect();
	await client.query("SELECT 1");
	process.stdout.write(`DB_CHECK ref=${ref || "-"} code=ok\n`);
} catch (error) {
	const code = /** @type {{ code?: string, name?: string }} */ (error).code ?? /** @type {Error} */ (error).name;
	process.stdout.write(`DB_CHECK ref=${ref || "-"} code=${code}\n`);
} finally {
	await client.end().catch(() => undefined);
}

process.exit(0);
