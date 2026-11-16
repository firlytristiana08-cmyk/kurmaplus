/// <reference types="vitest/config" />
import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Klien pengganti untuk server dev: gaya CSS tetap ter-inject, tetapi TANPA
// websocket, ping, atau muat ulang halaman. Klien Vite bawaan memuat ulang
// halaman sendiri saat koneksi putus-nyambung lewat proksi pratinjau — itulah
// tampilan "hilang-muncul" yang dikeluhkan. (Lihat DECISIONS.md.)
// PENTING: klien bawaan juga menetapkan semua konstanta define (__SVELTEKIT_*)
// sebagai global sebelum modul lain dievaluasi. Karena stub ini
// menggantikannya, blok penetapan global HARUS disuntikkan di depan stub
// (lihat define_globals di devStableClient) — tanpa itu, setiap referensi
// __SVELTEKIT_* di modul klien melempar ReferenceError dan interaksi mati.
const DEV_CLIENT_STUB = `
const sheets = new Map();
export function updateStyle(id, content) {
  let el = sheets.get(id);
  if (!el) {
    el = document.createElement("style");
    el.setAttribute("data-vite-dev-id", id);
    document.head.appendChild(el);
    sheets.set(id, el);
  }
  el.textContent = content;
}
export function removeStyle(id) {
  const el = sheets.get(id);
  if (el) { el.remove(); sheets.delete(id); }
}
export function createHotContext() {
  return {
    on() {}, off() {}, once() {}, accept() {}, dispose() {}, prune() {},
    invalidate() {}, decline() {}, send() {}, data: {}
  };
}
export function injectQuery(url, query) {
  return url + (url.includes("?") ? "&" : "?") + query;
}
export class ErrorOverlay {}
export default {};
`;

// Identitas unik tiap kali server dev dijalankan. Halaman yang masih menyimpan
// modul generasi sebelumnya akan mendeteksi perbedaan versi dan memuat ulang
// diri, sehingga klik/tombol tidak pernah "mati" karena modul campuran.
const DEV_RUN_ID = Date.now().toString(36);

// Modul rute dinamis beralamat kurung ([slug], [kode]) dilaporkan gagal dimuat
// di beberapa proksi pratinjau. Alamat modul ditulis tanpa kurung (@slug, @kode)
// dan dipetakan kembali ke berkas aslinya sebelum diproses Vite.
const ROUTE_SEGMENT_ALIAS_RE = /@([a-zA-Z_]+)/g;

function devStableClient() {
  return {
    name: "kurmaplus-dev-stable-client",
    configureServer(server: {
      config: { define?: Record<string, string> };
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: {
              setHeader: (k: string, v: string | number | string[]) => void;
              getHeader: (k: string) => string | number | undefined;
              removeHeader: (k: string) => void;
              write: (chunk: string | Buffer, ...rest: unknown[]) => boolean;
              end: (body: string) => void;
            },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      // Konstanta define SvelteKit (__SVELTEKIT_*) harus menjadi global sebelum
      // modul klien lain dievaluasi; klien Vite bawaan melakukannya lewat
      // __DEFINES__, tetapi kita menggantikan klien itu. Suntikkan sendiri:
      // nilai mentah define dievaluasi dan ditetapkan di globalThis.
      const define_globals = Object.entries(server.config.define ?? {})
        .filter(([key]) => /^__SVELTEKIT_[A-Z0-9_]+__$/.test(key))
        .map(([key, value]) => `try { globalThis.${key} = (${value}); } catch {}`)
        .join("\n");
      const dev_client = `${define_globals}\n${DEV_CLIENT_STUB}`;
      server.middlewares.use((req, res, next) => {
        // Semua respons dev tanpa cache: pemuatan selalu segar dari server ini,
        // tidak mungkin mencampur modul lama dan baru (penyebab klik mati).
        // Header dipaksa no-store apa pun yang ditetapkan middleware lain.
        const originalSetHeader = res.setHeader.bind(res);
        res.setHeader = (key: string, value: string | number | string[]) => {
          if (key.toLowerCase() === "cache-control") {
            value = "no-store";
          }
          return originalSetHeader(key, value);
        };
        res.setHeader("Cache-Control", "no-store");

        let url = req.url ?? "";
        // @slug -> [slug] pada permintaan modul (lihat ROUTE_SEGMENT_ALIAS_RE).
        if (url.includes("/src/routes/") && url.includes("@")) {
          url = url.replace(ROUTE_SEGMENT_ALIAS_RE, "[$1]");
          req.url = url;
        }

        // Tulis ulang alamat modul kurung di respons JS ([slug] -> @slug).
        // Diagnostik disuntikkan lewat src/app.html, bukan lewat respons,
        // agar tidak pernah menyentuh aliran body HTML.
        const originalEnd = ((res.end as unknown) as (
          body?: string | Buffer,
          ...rest: unknown[]
        ) => void).bind(res);
        res.end = (body?: string | Buffer, ...rest: unknown[]) => {
          try {
            const type = String(res.getHeader("content-type") ?? "");
            const tail =
              typeof body === "string"
                ? body
                : Buffer.isBuffer(body)
                  ? body.toString("utf8")
                  : "";
            if (type.includes("javascript") && tail.includes("/src/routes/")) {
              res.removeHeader("content-length");
              return originalEnd(
                tail.replace(/(\/src\/routes\/[^"'\`?]*?)\[([a-zA-Z_]+)\]/g, "$1@$2"),
                ...rest,
              );
            }
          } catch {
            /* penulisan ulang bersifat opsional; respons tetap dilanjutkan */
          }
          return originalEnd(body, ...rest);
        };

        if (url.startsWith("/@vite/client")) {
          res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          res.end(dev_client);
          return;
        }
        if (url.startsWith("/_app/version.json")) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ version: "kurmaplus-dev-" + DEV_RUN_ID }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
	plugins: [
    devStableClient(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
    }),
  ],
  server: {
    // Pratinjau diakses lewat host proksi, bukan localhost.
    host: true,
    allowedHosts: true,
    // Websocket HMR tidak stabil lewat proksi pratinjau dan bisa memicu
    // muat ulang halaman sendiri; dimatikan agar tampilan tidak berkedip.
    // Refresh manual selalu melihat perubahan terbaru (tanpa cache dev).
    hmr: false,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
