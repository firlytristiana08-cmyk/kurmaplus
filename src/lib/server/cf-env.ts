// Jembatan lingkungan Cloudflare (adapter-cloudflare). Binding seperti
// Hyperdrive hanya tersedia lewat `event.platform.env` per-request — bukan
// `process.env` — sehingga hook server menangkapnya di sini, dan modul lain
// (db.ts) membacanya lewat helper saat membuat koneksi.

interface HyperdriveBinding {
  connectionString: string;
}

interface PlatformEnv {
  HYPERDRIVE?: HyperdriveBinding;
}

let captured: PlatformEnv | null = null;

export function setPlatformEnv(env: unknown): void {
  if (env && typeof env === "object") {
    captured = env as PlatformEnv;
  }
}

// String koneksi dari Hyperdrive bila binding tersedia (Cloudflare Workers),
// selain itu null — pemanggil memakai jalur env biasa (Vercel/lokal).
export function hyperdriveConnectionString(): string | null {
  const value = captured?.HYPERDRIVE?.connectionString;
  return typeof value === "string" && value.length > 0 ? value : null;
}
