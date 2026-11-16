/// <reference types="vitest/config" />
import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
      // Build pratinjau (KURMAPLUS_PREVIEW=1) berjalan di balik proksi yang
      // URL publiknya tidak diketahui saat build, jadi semua origin dipercaya
      // HANYA di build pratinjau. Build produksi/Vercel tetap memeriksa origin.
      csrf: { trustedOrigins: process.env.KURMAPLUS_PREVIEW ? ["*"] : [] },
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
