// Validasi input pembeli (FR-04, FR-06, FR-07) dengan Valibot (PRD: skema
// yang sama bisa dipakai di server dan klien). Alasan file ini di luar daftar
// modul server PRD: memisahkan skema validasi dari akses data.

import * as v from "valibot";
import { JABODETABEK_CITIES } from "./geo";

// FR-04: nomor 08... dan +62... disimpan seragam sebagai 62...
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  let digits: string;
  if (cleaned.startsWith("+62")) {
    digits = `62${cleaned.slice(3)}`;
  } else if (cleaned.startsWith("62")) {
    digits = cleaned;
  } else if (cleaned.startsWith("0")) {
    digits = `62${cleaned.slice(1)}`;
  } else {
    return null;
  }
  if (!/^62\d{8,12}$/.test(digits)) {
    return null;
  }
  return digits;
}

export const checkoutSchema = v.object({
  customerName: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, "Nama minimal 2 karakter."),
    v.maxLength(80, "Nama maksimal 80 karakter."),
  ),
  customerPhone: v.pipe(v.string(), v.trim(), v.minLength(8, "Nomor WhatsApp wajib diisi.")),
  address: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(5, "Alamat minimal 5 karakter."),
    v.maxLength(200, "Alamat maksimal 200 karakter."),
  ),
  city: v.picklist([...JABODETABEK_CITIES], "Kota atau kabupaten belum dipilih."),
  note: v.optional(v.pipe(v.string(), v.maxLength(500, "Catatan maksimal 500 karakter.")), ""),
  courier: v.picklist(["Grab", "Gojek"], "Pilih kurir Grab atau Gojek."),
  deliveryDate: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal kirim tidak sah.")),
  lat: v.pipe(
    v.number(),
    v.minValue(-90, "Titik peta belum sah."),
    v.maxValue(90, "Titik peta belum sah."),
  ),
  lng: v.pipe(
    v.number(),
    v.minValue(-180, "Titik peta belum sah."),
    v.maxValue(180, "Titik peta belum sah."),
  ),
  items: v.pipe(
    v.array(
      v.object({
        variantId: v.pipe(v.number(), v.integer(), v.minValue(1)),
        qty: v.pipe(
          v.number(),
          v.integer(),
          v.minValue(1, "Jumlah minimal 1."),
          v.maxValue(99, "Jumlah maksimal 99 per baris."),
        ),
      }),
    ),
    v.minLength(1, "Keranjang kosong."),
  ),
});

export type CheckoutInput = v.InferOutput<typeof checkoutSchema>;
