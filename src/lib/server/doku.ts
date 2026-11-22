// Klien DOKU Checkout (PRD: Integrasi DOKU) — ditulis sendiri memakai Web
// Crypto bawaan, tanpa paket pihak ketiga karena kode ini menyentuh uang.
// Rumus signature dan jalur endpoint dikonfirmasi dari dokumentasi resmi
// developers.doku.com (Non-SNAP): POST /checkout/v1/payment,
// GET /orders/v1/status/{invoice}, notifikasi POST dengan header signature.

export interface DokuConfig {
  clientId: string;
  secretKey: string;
  baseUrl: string;
}

export interface DokuPaymentResult {
  paymentUrl: string;
  expiredDate: string;
}

export interface DokuStatusResult {
  transactionStatus: string;
  orderStatus: string | null;
}

const encoder = new TextEncoder();

const SANDBOX_BASE_URL = "https://api-sandbox.doku.com";

// Pengaman go-live (fail-closed): pembayaran NYATA tidak boleh diam-diam
// diarahkan ke sandbox.
//
// Kenapa tidak memakai NODE_ENV seperti sebelumnya: di Cloudflare Workers
// adapter memakai `no_bundle`, sehingga wrangler tidak membangkitkan ulang
// bundel dan `process.env.NODE_ENV` TIDAK terisi "production" saat deploy
// (terbukti: nilainya kosong). Akibatnya proteksi lama tidak pernah aktif.
// Karena itu lingkungan ditentukan lewat variabel eksplisit `DOKU_ENV`.
//
// Aturannya:
// - `DOKU_ENV=production` → WAJIB `DOKU_BASE_URL`; tanpa itu konfigurasi
//   ditolak (checkout jatuh ke mode simulasi, bukan menagih ke sandbox).
// - `DOKU_ENV=sandbox` → sandbox, boleh tanpa `DOKU_BASE_URL`.
// - `DOKU_ENV` kosong → aman untuk pengembangan lokal/Vercel lama: perilaku
//   lama dipertahankan, KECUALI host produksi yang dikenal (lihat
//   PRODUCTION_HOSTS) — di sana tetap wajib eksplisit.
const PRODUCTION_HOSTS = ["kurmaplus.hasbidiqi16.workers.dev"];

function isProductionContext(env: Record<string, string | undefined>): boolean {
  const declared = (env.DOKU_ENV ?? "").trim().toLowerCase();
  if (declared === "production" || declared === "live") return true;
  if (declared === "sandbox" || declared === "dev" || declared === "development") return false;
  if (env.VERCEL_ENV === "production") return true;
  const host = (env.PUBLIC_BASE_URL ?? "").trim();
  return PRODUCTION_HOSTS.some((known) => host.includes(known));
}

export function loadDokuConfig(env: Record<string, string | undefined>): DokuConfig | null {
  const clientId = env.DOKU_CLIENT_ID;
  const secretKey = env.DOKU_SECRET_KEY;
  const baseUrl = (env.DOKU_BASE_URL ?? "").trim();
  if (!clientId || !secretKey) {
    return null;
  }
  if (baseUrl !== "") {
    // Alamat eksplisit selalu menang, tanpa tebakan.
    return { clientId, secretKey, baseUrl };
  }
  if (isProductionContext(env)) {
    // Gagal tertutup: lebih baik pembayaran daring dimatikan (pesanan tetap
    // tersimpan dan bisa dibayar dari halaman pesanan) daripada dana pembeli
    // diarahkan ke sandbox.
    return null;
  }
  return { clientId, secretKey, baseUrl: SANDBOX_BASE_URL };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function digestBase64(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(body));
  return toBase64(new Uint8Array(hash));
}

export interface SignatureParts {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  digest?: string;
}

// String-to-sign Non-SNAP: baris komponen dipisah \n, tanpa \n di akhir.
// Digest hanya untuk metode POST.
export function stringToSign(parts: SignatureParts): string {
  const lines = [
    `Client-Id:${parts.clientId}`,
    `Request-Id:${parts.requestId}`,
    `Request-Timestamp:${parts.requestTimestamp}`,
    `Request-Target:${parts.requestTarget}`,
  ];
  if (parts.digest !== undefined) {
    lines.push(`Digest:${parts.digest}`);
  }
  return lines.join("\n");
}

export async function signHmacSha256(secretKey: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `HMACSHA256=${toBase64(new Uint8Array(mac))}`;
}

export function requestTimestamp(now: Date): string {
  return `${now.toISOString().replace(/\.\d{3}Z$/, "Z")}`;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

async function signedHeaders(
  config: DokuConfig,
  requestId: string,
  timestamp: string,
  target: string,
  body: string | null,
): Promise<Record<string, string>> {
  const digest = body === null ? undefined : await digestBase64(body);
  const signature = await signHmacSha256(
    config.secretKey,
    stringToSign({
      clientId: config.clientId,
      requestId,
      requestTimestamp: timestamp,
      requestTarget: target,
      digest,
    }),
  );
  const headers: Record<string, string> = {
    "Client-Id": config.clientId,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    Signature: signature,
    "Content-Type": "application/json",
  };
  return headers;
}

export interface DokuCheckoutPayload {
  invoiceNumber: string;
  amountIdr: number;
  paymentDueMinutes: number;
  customer: { name: string; phone: string; address: string; city: string; email?: string };
  callbackUrl: string;
  notificationUrl: string;
  lineItems: { name: string; quantity: number; price: number }[];
}

// Format nomor telepon DOKU: {kode_negara}{nomor}, contoh 6281122334455.
export function normalizeDokuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return `62${digits}`;
}

// Membuat sesi DOKU Checkout (FR-11): invoice = kode pesanan.
export async function createCheckoutPayment(
  config: DokuConfig,
  payload: DokuCheckoutPayload,
  now: Date = new Date(),
): Promise<DokuPaymentResult> {
  const target = "/checkout/v1/payment";
  const body = JSON.stringify({
    order: {
      amount: payload.amountIdr,
      invoice_number: payload.invoiceNumber,
      currency: "IDR",
      callback_url: payload.callbackUrl,
      callback_url_result: payload.callbackUrl,
      language: "ID",
      auto_redirect: true,
      line_items: payload.lineItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    },
    payment: {
      payment_due_date: payload.paymentDueMinutes,
    },
    additional_info: {
      // Jaring pengaman ganda: URL notifikasi dikirim per transaksi, di luar
      // pengaturan Payment Notification URL di dashboard DOKU.
      override_notification_url: payload.notificationUrl,
    },
    customer: {
      name: payload.customer.name,
      phone: normalizeDokuPhone(payload.customer.phone),
      ...(payload.customer.email ? { email: payload.customer.email } : {}),
      address: payload.customer.address,
      city: payload.customer.city,
      country: "ID",
    },
  });
  const requestId = newRequestId();
  const headers = await signedHeaders(config, requestId, requestTimestamp(now), target, body);
  const response = await fetch(`${config.baseUrl}${target}`, {
    method: "POST",
    headers,
    body,
  });
  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    response?: { payment?: { url?: string; expired_date?: string } };
  };
  const paymentUrl = data.response?.payment?.url;
  const expiredDate = data.response?.payment?.expired_date;
  if (!response.ok || !paymentUrl || !expiredDate) {
    const detail = Array.isArray(data.message)
      ? data.message.map(String).join("; ")
      : typeof data.message === "string"
        ? data.message
        : "";
    throw new Error(
      `DOKU menolak permintaan pembayaran (HTTP ${response.status})${detail === "" ? "" : `: ${detail}`}`,
    );
  }
  return { paymentUrl, expiredDate };
}

// Check Status API (FR-14): dipakai halaman status saat masih menunggu bayar.
export async function checkStatus(
  config: DokuConfig,
  invoiceNumber: string,
  now: Date = new Date(),
): Promise<DokuStatusResult> {
  const target = `/orders/v1/status/${invoiceNumber}`;
  const requestId = newRequestId();
  const headers = await signedHeaders(config, requestId, requestTimestamp(now), target, null);
  const response = await fetch(`${config.baseUrl}${target}`, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`DOKU Check Status gagal (HTTP ${response.status})`);
  }
  const data = (await response.json()) as {
    transaction?: { status?: string };
    order?: { status?: string };
  };
  return {
    transactionStatus: data.transaction?.status ?? "UNKNOWN",
    orderStatus: data.order?.status ?? null,
  };
}

// Verifikasi notifikasi DOKU (FR-12) memakai isi mentah permintaan.
export async function verifyNotificationSignature(params: {
  config: DokuConfig;
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  rawBody: string;
  signature: string;
}): Promise<boolean> {
  if (params.clientId !== params.config.clientId) {
    return false;
  }
  const digest = await digestBase64(params.rawBody);
  const expected = await signHmacSha256(
    params.config.secretKey,
    stringToSign({
      clientId: params.clientId,
      requestId: params.requestId,
      requestTimestamp: params.requestTimestamp,
      requestTarget: params.requestTarget,
      digest,
    }),
  );
  return expected === params.signature;
}
