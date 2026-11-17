// Keranjang tersimpan di perangkat (FR-03): runes Svelte 5 + localStorage
// dengan try/catch. Server selalu memvalidasi ulang harga dan stok.

export interface CartItem {
  variantId: number;
  qty: number;
}

const STORAGE_KEY = "kurmaplus-cart";

function sanitizeItems(parsed: unknown): CartItem[] | null {
  if (!Array.isArray(parsed)) {
    return null;
  }
  const items = parsed.filter(
    (item): item is CartItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as CartItem).variantId === "number" &&
      typeof (item as CartItem).qty === "number",
  );
  return items.length > 0 ? items : null;
}

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return sanitizeItems(JSON.parse(raw || "null")) ?? [];
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* penyimpanan penuh atau ditolak: keranjang tetap hidup di memori */
  }
}

class CartState {
  items = $state<CartItem[]>([]);
  #hydrated = false;

  hydrate(): void {
    if (!this.#hydrated && typeof window !== "undefined") {
      this.items = readStorage();
      this.#hydrated = true;
    }
  }

  setItems(items: CartItem[]): void {
    this.items = items;
    writeStorage(items);
  }

  add(variantId: number, qty: number): void {
    const existing = this.items.find((item) => item.variantId === variantId);
    if (existing) {
      existing.qty = Math.min(99, existing.qty + qty);
    } else {
      this.items.push({ variantId, qty });
    }
    this.setItems([...this.items]);
  }

  setQty(variantId: number, qty: number): void {
    if (qty < 1) {
      this.remove(variantId);
      return;
    }
    const existing = this.items.find((item) => item.variantId === variantId);
    if (existing) {
      existing.qty = Math.min(99, qty);
      this.setItems([...this.items]);
    }
  }

  remove(variantId: number): void {
    this.setItems(this.items.filter((item) => item.variantId !== variantId));
  }

  redeemPurchased(purchased: CartItem[]): void {
    // Item yang sudah dibeli dikeluarkan dari keranjang (cegah terbeli dua kali).
    const remaining = this.items
      .map((item) => {
        const bought = purchased
          .filter((entry) => entry.variantId === item.variantId)
          .reduce((sum, entry) => sum + entry.qty, 0);
        return { variantId: item.variantId, qty: item.qty - bought };
      })
      .filter((item) => item.qty > 0);
    this.setItems(remaining);
  }

  clear(): void {
    this.setItems([]);
  }

  get count(): number {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  }
}

export const cart = new CartState();

// Pembelian langsung (tombol "Beli langsung"): daftar item terpisah dari
// keranjang, dipakai untuk satu kali checkout lalu dibuang.
const DIRECT_KEY = "kurmaplus-direct-buy";
const BACKUP_KEY = "kurmaplus-cart-backup";

export function readDirectBuy(): CartItem[] | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return sanitizeItems(JSON.parse(window.sessionStorage.getItem(DIRECT_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function setDirectBuy(items: CartItem[]): void {
  try {
    window.sessionStorage.setItem(DIRECT_KEY, JSON.stringify(items));
  } catch {
    /* penyimpanan ditolak: checkout akan memakai isi keranjang */
  }
}

export function clearDirectBuy(): void {
  try {
    window.sessionStorage.removeItem(DIRECT_KEY);
  } catch {
    /* tidak ada yang perlu dilakukan */
  }
}

export function backupCart(items: CartItem[]): void {
  try {
    window.sessionStorage.setItem(BACKUP_KEY, JSON.stringify(items));
  } catch {
    /* tanpa cadangan: pemulihan tidak tersedia */
  }
}

export function restoreCartBackup(): void {
  try {
    const raw = window.sessionStorage.getItem(BACKUP_KEY);
    if (!raw) {
      return;
    }
    window.sessionStorage.removeItem(BACKUP_KEY);
    const items = sanitizeItems(JSON.parse(raw));
    if (items) {
      cart.setItems(items);
    }
  } catch {
    /* abaikan */
  }
}
