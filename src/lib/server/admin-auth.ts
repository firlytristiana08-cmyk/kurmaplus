// Gerbang masuk Portal Admin (PRD: Supabase Auth — email, password, MFA TOTP).
// Aturan:
// - Pratinjau/pengembangan: sesi demo khusus dev (tidak pernah aktif di produksi
//   karena bergantung pada import.meta.env.DEV yang selalu false di build produksi).
// - Produksi: GAGAL-TERTUTUP — hanya sesi Supabase yang terverifikasi server-side,
//   dengan MFA (aal2) dan email terdaftar di tabel admin_users.

import type { Cookies } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { getDb } from "./db";

export const ADMIN_COOKIE = "kurma_admin_session";
const DEV_TOKEN = "demo-owner";
const DEV_SESSION: AdminSession = {
  email: "pemilik@kurmaplus.dev",
  label: "Pemilik (demo)",
  mode: "demo",
};

export interface AdminSession {
  email: string;
  label: string;
  mode: "demo" | "supabase";
}

interface SupabaseEnv {
  url: string;
  anonKey: string;
}

function supabaseEnv(): SupabaseEnv | null {
  const url =
    process.env.SUPABASE_URL ??
    (process.env.SUPABASE_PROJECT_REF
      ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`
      : null);
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

// Isi JWT (klaim aal) dibaca setelah tanda tangannya diverifikasi oleh GoTrue
// lewat auth.getUser — token palsu tidak akan lolos verifikasi.
function jwtClaims(token: string): { aal?: string; email?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function isRegisteredAdmin(email: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ email: string }>("SELECT email FROM admin_users WHERE email = ?", [
    email,
  ]);
  return row !== undefined;
}

async function verifySupabaseToken(token: string): Promise<AdminSession | null> {
  const env = supabaseEnv();
  if (!env) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email) return null;
    const claims = jwtClaims(token);
    if (claims?.aal !== "aal2") return null; // MFA wajib (PRD: sesi aal2).
    if (!(await isRegisteredAdmin(data.user.email))) return null;
    return { email: data.user.email, label: "Pemilik", mode: "supabase" };
  } catch {
    return null;
  }
}

export async function readAdminSession(cookies: Cookies): Promise<AdminSession | null> {
  const token = cookies.get(ADMIN_COOKIE);
  if (!token) return null;
  if (import.meta.env.DEV && token === DEV_TOKEN) return DEV_SESSION;
  return verifySupabaseToken(token);
}

export function setDevSession(cookies: Cookies): void {
  if (!import.meta.env.DEV) return;
  cookies.set(ADMIN_COOKIE, DEV_TOKEN, {
    path: "/",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 8,
  });
}

export function clearAdminSession(cookies: Cookies): void {
  cookies.delete(ADMIN_COOKIE, { path: "/" });
}

// Dipakai semua halaman admin: tanpa sesi sah, langsung ke /admin/masuk.
export async function requireAdmin(cookies: Cookies): Promise<AdminSession> {
  const session = await readAdminSession(cookies);
  if (!session) redirect(303, "/admin/masuk");
  return session;
}

export interface SignInResult {
  ok: boolean;
  error?: string;
  needsMfa?: boolean;
}

// Masuk produksi: email + password, lalu kode authenticator bila MFA aktif.
export async function adminSignIn(
  email: string,
  password: string,
  totpCode: string | null,
  cookies: Cookies,
): Promise<SignInResult> {
  if (import.meta.env.DEV) {
    // Dev: tombol demo, tanpa jaringan.
    setDevSession(cookies);
    return { ok: true };
  }
  const env = supabaseEnv();
  if (!env) {
    return {
      ok: false,
      error: "Supabase Auth belum dikonfigurasi di server (SUPABASE_URL + kunci publishable).",
    };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
    let accessToken: string | null = null;

    if (totpCode === null) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        return { ok: false, error: "Email atau password salah." };
      }
      const claims = jwtClaims(data.session.access_token);
      if (claims?.aal === "aal2") {
        accessToken = data.session.access_token;
      } else {
        // MFA: tantang faktor TOTP lalu minta kode.
        const { data: factors } = await client.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (!totp) {
          return { ok: false, error: "Akun belum menyiapkan authenticator (MFA)." };
        }
        const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
          factorId: totp.id,
        });
        if (challengeError || !challenge) {
          return { ok: false, error: "Gagal membuat tantangan MFA." };
        }
        cookies.set(ADMIN_COOKIE, `mfa:${totp.id}:${challenge.id}`, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 300,
        });
        return { ok: true, needsMfa: true };
      }
    } else {
      const raw = cookies.get(ADMIN_COOKIE) ?? "";
      const [, factorId, challengeId] = raw.split(":");
      if (!factorId || !challengeId) {
        return { ok: false, error: "Sesi MFA kedaluwarsa — masuk ulang." };
      }
      // Buat sesi password singkat ulang untuk verifikasi; GoTrue menerima
      // verifikasi TOTP memakai tantangan aktif.
      const { data: verified, error: verifyError } = await client.auth.mfa.verify({
        factorId,
        challengeId,
        code: totpCode,
      });
      if (verifyError || !verified?.access_token) {
        return { ok: false, error: "Kode authenticator salah." };
      }
      accessToken = verified.access_token;
    }

    if (!accessToken) return { ok: false, error: "Gagal membentuk sesi." };
    const claims = jwtClaims(accessToken);
    const emailClaim = claims?.email ?? email;
    if (claims?.aal !== "aal2") {
      return { ok: false, error: "Sesi belum melewati MFA (wajib aal2)." };
    }
    if (!(await isRegisteredAdmin(emailClaim))) {
      return { ok: false, error: "Email ini tidak terdaftar sebagai admin." };
    }
    cookies.set(ADMIN_COOKIE, accessToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Login gagal — periksa koneksi dan konfigurasi Supabase Auth." };
  }
}
