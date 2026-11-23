// Gerbang masuk Portal Admin (PRD: Supabase Auth — email + password).
// Aturan:
// - Pratinjau/pengembangan: sesi demo khusus dev (tidak pernah aktif di produksi
//   karena bergantung pada import.meta.env.DEV yang selalu false di build produksi).
// - Produksi: GAGAL-TERTUTUP — hanya sesi Supabase yang terverifikasi server-side,
//   dengan email terdaftar di tabel admin_users.
// - MFA/authenticator TIDAK dipakai (permintaan pemilik 17 Nov 2026).

import type { Cookies } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { TtlCache, cacheKeyForToken } from "./auth-cache";
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

export function supabaseEnv(): SupabaseEnv | null {
  const url =
    process.env.SUPABASE_URL ??
    (process.env.SUPABASE_PROJECT_REF
      ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`
      : null);
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

// Isi JWT (klaim email) dibaca setelah tanda tangannya diverifikasi oleh GoTrue
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
    if (!(await isRegisteredAdmin(data.user.email))) return null;
    return { email: data.user.email, label: "Pemilik", mode: "supabase" };
  } catch {
    return null;
  }
}

// Cache hasil verifikasi yang SAH saja (lihat auth-cache.ts). Satu klik tombol
// admin sebelumnya memicu 3 verifikasi = 6 panggilan jaringan; dengan cache
// hanya tersisa 1 verifikasi untuk request pertama dalam jendela TTL.
// Hasil gagal TIDAK pernah di-cache: token palsu/kadaluarsa tetap ditolak.
const SESSION_CACHE_TTL_MS = Number(process.env.KURMAPLUS_SESSION_CACHE_MS ?? 60_000);
const sessionCache = new TtlCache<AdminSession>(SESSION_CACHE_TTL_MS);

export async function readAdminSession(cookies: Cookies): Promise<AdminSession | null> {
  const token = cookies.get(ADMIN_COOKIE);
  if (!token) return null;
  if (import.meta.env.DEV && token === DEV_TOKEN) return DEV_SESSION;

  const key = await cacheKeyForToken(token);
  const cached = sessionCache.get(key);
  if (cached) return cached;

  const session = await verifySupabaseToken(token);
  // Hanya simpan hasil yang sah.
  if (session) sessionCache.set(key, session);
  return session;
}

// Dipakai saat masuk/keluar akun supaya tidak ada sesi basi yang terpakai.
export function forgetAdminSession(token: string): Promise<void> {
  return cacheKeyForToken(token).then((key) => {
    sessionCache.delete(key);
  });
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
}

// Masuk produksi: email + password (Supabase Auth), tanpa MFA.
export async function adminSignIn(
  email: string,
  password: string,
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
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { ok: false, error: "Email atau password salah." };
    }
    const claims = jwtClaims(data.session.access_token);
    const emailClaim = claims?.email ?? email;
    if (!(await isRegisteredAdmin(emailClaim))) {
      return { ok: false, error: "Email ini tidak terdaftar sebagai admin." };
    }
    cookies.set(ADMIN_COOKIE, data.session.access_token, {
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
