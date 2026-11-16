/// <reference types="vitest/config" />
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
    }),
  ],
  server: {
    // Pratinjau diakses lewat host proksi, bukan localhost.
    host: true,
    allowedHosts: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
