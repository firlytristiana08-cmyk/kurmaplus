// Halaman masuk admin. Pratinjau/dev: tombol sesi demo. Produksi: Supabase
// Auth (email + password), gagal-tertutup bila belum dikonfigurasi.
// Lihat src/lib/server/admin-auth.ts.

import { fail, redirect } from "@sveltejs/kit";
import {
  ADMIN_COOKIE,
  adminSignIn,
  clearAdminSession,
  forgetAdminSession,
  readAdminSession,
  setDevSession,
} from "#lib/server/admin-auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  const session = await readAdminSession(cookies);
  return { session, isDev: import.meta.env.DEV };
};

export const actions: Actions = {
  demo: async ({ cookies }) => {
    if (!import.meta.env.DEV) return fail(403, { message: "Tidak tersedia di produksi." });
    setDevSession(cookies);
    redirect(303, "/admin?sesi=demo");
  },
  masuk: async ({ cookies, request }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (email === "" || password === "") {
      return fail(400, { message: "Email dan password wajib diisi." });
    }
    const result = await adminSignIn(email, password, cookies);
    if (!result.ok) return fail(400, { message: result.error ?? "Gagal masuk." });
    redirect(303, "/admin");
  },
  keluar: async ({ cookies }) => {
    // Buang hasil verifikasi yang di-cache untuk token ini, lalu hapus cookie.
    // Tanpa ini, token yang baru dipakai bisa tetap dianggap sah sampai TTL
    // habis bila cookie-nya masih tersimpan di peramban lain.
    const token = cookies.get(ADMIN_COOKIE);
    if (token) await forgetAdminSession(token);
    clearAdminSession(cookies);
    redirect(303, "/admin/masuk");
  },
};
