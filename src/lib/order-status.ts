// Status pesanan (PRD Model data): tipe dan label Indonesia.
// Modul bersama (dipakai halaman pesanan di browser dan lapisan server).
//
// Catatan: aturan transisi TIDAK didefinisikan di sini. Satu-satunya sumber
// kebenaran adalah adminChangeStatus() di src/lib/server/admin.ts, yang
// mengizinkan koreksi mundur (dengan alasan wajib) — sesuatu yang tidak bisa
// diwakili tabel transisi sederhana. Dulu ada canTransition() di sini, tetapi
// tidak pernah dipakai dan justru bertentangan dengan perilaku tersebut.

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "packed"
  | "shipped"
  | "done"
  | "expired"
  | "cancelled";

export const STATUS_LABEL_ID: Record<OrderStatus, string> = {
  pending_payment: "Menunggu bayar",
  paid: "Dibayar",
  packed: "Dikemas",
  shipped: "Dikirim",
  done: "Selesai",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return value in STATUS_LABEL_ID;
}
