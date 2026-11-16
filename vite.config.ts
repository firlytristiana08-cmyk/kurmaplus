/// <reference types="vitest/config" />
import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Klien pengganti untuk server dev: gaya CSS tetap ter-inject, tetapi TANPA
// websocket, ping, atau muat ulang halaman. Klien Vite bawaan memuat ulang
// halaman sendiri saat koneksi putus-nyambung lewat proksi pratinjau — itulah
// tampilan "hilang-muncul" yang dikeluhkan. (Lihat DECISIONS.md.)
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

function devStableClient() {
  return {
    name: "kurmaplus-dev-stable-client",
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: {
              setHeader: (k: string, v: string) => void;
              end: (body: string) => void;
            },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
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
        const url = req.url ?? "";
        if (url.startsWith("/@vite/client")) {
          res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          res.end(DEV_CLIENT_STUB);
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
