// Halaman masuk admin. Pratinjau/dev: tombol sesi demo. Produksi: Supabase
// Auth (email + password + kode authenticator), gagal-tertutup bila belum
// dikonfigurasi. Lihat src/lib/server/admin-auth.ts.

import { fail, redirect } from "@sveltejs/kit";
import {
  adminSignIn,
  adminVerifyMfa,
  clearAdminSession,
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
    const totpRaw = String(form.get("totp") ?? "").trim();
    if (totpRaw !== "") {
      // Langkah 2: verifikasi kode authenticator (mfa: / aktivasi: di cookie).
      const result = await adminVerifyMfa(totpRaw, cookies);
      if (!result.ok) return fail(400, { message: result.error ?? "Gagal verifikasi." });
      redirect(303, "/admin");
    }
    if (email === "" || password === "") {
      return fail(400, { message: "Email dan password wajib diisi." });
    }
    const result = await adminSignIn(email, password, cookies);
    if (!result.ok) return fail(400, { message: result.error ?? "Gagal masuk." });
    if (result.needsMfa) return { needsMfa: true, email };
    if (result.needsEnroll) {
      return {
        needsEnroll: true,
        qrSvg: result.qrSvg ?? "",
        secret: result.secret ?? "",
      };
    }
    redirect(303, "/admin");
  },
  keluar: async ({ cookies }) => {
    clearAdminSession(cookies);
    redirect(303, "/admin/masuk");
  },
};
