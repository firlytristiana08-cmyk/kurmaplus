// Status pesanan (PRD Model data): tipe, label Indonesia, dan aturan transisi.
// Modul bersama (dipakai halaman pesanan di browser dan lapisan server).

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "packed"
  | "shipped"
  | "done"
  | "expired"
  | "cancelled";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "expired", "cancelled"],
  paid: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["done"],
  done: [],
  expired: [],
  cancelled: [],
};

// Pesanan yang sudah dibayar tidak pernah kembali menjadi kedaluwarsa;
// transisi hanya maju mengikuti urutan alur.
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return false;
  }
  if (from === "paid" && to === "expired") {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

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
