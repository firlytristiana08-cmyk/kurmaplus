// Kode pesanan acak (FR/BR terkait). Aturan status pesanan ada di
// src/lib/order-status (modul bersama) agar bisa dipakai halaman browser.

import { isOrderStatus, type OrderStatus, STATUS_LABEL_ID } from "../order-status";

export { isOrderStatus, type OrderStatus, STATUS_LABEL_ID };

// Kode pesanan acak 8 karakter, tidak berurutan (Model data: orders.code).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}
