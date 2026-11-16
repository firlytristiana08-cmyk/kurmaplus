// Cek koneksi database saat build Vercel (prebuild). Hasilnya dicetak sebagai
// baris `DB_CHECK …` di log build — hanya kode galat, TANPA kata sandi.
// Menguji beberapa jalur sekaligus (langsung + pooler Supabase) supaya ketahuan
// jalur mana yang bisa dipakai dari jaringan Vercel.

import { setDefaultResultOrder } from "node:dns";
import { Client } from "pg";

// Lihat src/lib/server/db.ts: paksa IPv4 (host Supabase me-resolve IPv6 duluan).
setDefaultResultOrder("ipv4first");

const clean = (value) => (value ?? "").trim().replace(/^["']|["']$/g, "");

function describe(error) {
  if (!(error instanceof Error)) return "code=UNKNOWN";
  const code = /** @type {{code?: string}} */ (error).code ?? "UNKNOWN";
  const address = /** @type {{address?: string}} */ (error).address;
  const family = /** @type {{family?: string | number}} */ (error).family;
  return address
    ? `code=${code} family=${family ?? "?"} address=${address}`
    : `code=${code}`;
}

async function probe(target, { host, port, user, password, database }) {
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 2500
  });
  try {
    await client.connect();
    await client.query("select 1");
    console.log(`DB_CHECK ref=${host} target=${target} result=ok`);
    await client.end();
  } catch (error) {
    console.log(`DB_CHECK ref=${host} target=${target} ${describe(error)}`);
  }
}

const password = clean(process.env.SUPABASE_DB_PASSWORD);
const ref = clean(process.env.SUPABASE_PROJECT_REF);
const explicitUrl = clean(process.env.SUPABASE_DB_URL) || clean(process.env.DATABASE_URL);

if (explicitUrl) {
  const url = new URL(explicitUrl);
  await probe("explicit", {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "postgres"
  });
} else if (ref && password) {
  // Region project (Supabase dashboard): ap-southeast-1.
  const region = clean(process.env.SUPABASE_REGION) || "ap-southeast-1";
  await probe("direct", {
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres"
  });
  await probe("pooler-session", {
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: "postgres"
  });
  await probe("pooler-transaction", {
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
    password,
    database: "postgres"
  });
} else {
  console.log("DB_CHECK ref=- target=none code=NO_ENV");
}
