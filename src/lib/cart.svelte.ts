// Keranjang tersimpan di perangkat (FR-03): runes Svelte 5 + localStorage
// dengan try/catch. Server selalu memvalidasi ulang harga dan stok.

export interface CartItem {
  variantId: number;
  qty: number;
}

const STORAGE_KEY = "kurmaplus-cart";

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).variantId === "number" &&
        typeof (item as CartItem).qty === "number",
    );
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

  clear(): void {
    this.setItems([]);
  }

  get count(): number {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  }
}

export const cart = new CartState();
