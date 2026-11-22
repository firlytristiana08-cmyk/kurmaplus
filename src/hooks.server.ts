// Pratinjau/dev: cookie pihak ketiga diblokir di dalam iframe pratinjau, jadi
// sesi demo juga diterima lewat URL (?sesi=demo). Hook ini menerjemahkan
// parameter tersebut menjadi sesi untuk request berjalan (dan mengirim
// Set-Cookie sebagai cadangan bila browser menerimanya). Produksi tidak
// terpengaruh — parameter diabaikan di luar mode DEV.
import type { Handle } from "@sveltejs/kit/hooks";
import { setPlatformEnv } from "./lib/server/cf-env";

const DEV_TOKEN = "demo-owner";
const DEV_SESSION_PARAM = "sesi";
const DEV_SESSION_VALUE = "demo";

export const handle: Handle = async ({ event, resolve }) => {
  // Cloudflare Workers: binding (mis. Hyperdrive) hanya tersedia lewat env
  // runtime. Platform diteruskan apa adanya — setPlatformEnv menerima objek
  // env langsung maupun bentuk { env }.
  setPlatformEnv(event.platform);
  if (
    import.meta.env.DEV &&
    event.url.pathname.startsWith("/admin") &&
    event.url.searchParams.get(DEV_SESSION_PARAM) === DEV_SESSION_VALUE
  ) {
    event.cookies.set("kurma_admin_session", DEV_TOKEN, {
      path: "/",
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 60 * 60 * 8,
    });
  }
  return resolve(event);
};
