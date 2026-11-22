// Jembatan lingkungan Cloudflare (adapter-cloudflare). Binding seperti
// Hyperdrive hanya tersedia lewat objek env runtime worker — bukan
// `process.env` — sehingga modul ini membacanya dari `cloudflare:workers`
// (sumber yang sama dipakai adapter saat init).
//
// Latar: adapter-cloudflare memanggil server.init({ env }) tanpa mengirim
// `platform` ke server.respond per request, sehingga `event.platform` selalu
// undefined di produksi Cloudflare. Karena itu tangkapan per-request tidak
// pernah mendapat env, dan modul ini juga menerima kiriman platform bila
// suatu saat adapter mulai mengirimnya lagi.

interface HyperdriveBinding {
  connectionString: string;
}

interface PlatformEnv {
  HYPERDRIVE?: HyperdriveBinding;
}

let captured: PlatformEnv | null = null;

// Impor env runtime workerd. Nama modul lewat variabel supaya bundler tidak
// mencoba mem-bangketkan modul ini saat build untuk platform lain; impor yang
// gagal (Vercel/lokal) ditangkap — di sana memang tidak ada binding Cloudflare.
const cloudflareWorkersModule = "cloudflare:workers";
try {
  const mod = (await import(/* @vite-ignore */ cloudflareWorkersModule)) as { env?: unknown };
  if (mod.env && typeof mod.env === "object") {
    captured = mod.env as PlatformEnv;
  }
} catch {
  /* runtime tanpa cloudflare:workers — tidak masalah */
}

export function setPlatformEnv(env: unknown): void {
  if (!env || typeof env !== "object") {
    return;
  }
  // Terima dua bentuk: objek env langsung, atau { env } (bentuk platform lama).
  const candidate = "env" in env ? (env as { env?: unknown }).env : env;
  if (candidate && typeof candidate === "object") {
    captured = candidate as PlatformEnv;
  }
}

// String koneksi dari Hyperdrive bila binding tersedia (Cloudflare Workers),
// selain itu null — pemanggil memakai jalur env biasa (Vercel/lokal).
export function hyperdriveConnectionString(): string | null {
  const value = captured?.HYPERDRIVE?.connectionString;
  return typeof value === "string" && value.length > 0 ? value : null;
}
