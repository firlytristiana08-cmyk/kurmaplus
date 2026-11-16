import { describe, expect, it } from "vitest";
import { canTransition, generateOrderCode, isOrderStatus } from "./orders";

describe("status pesanan (Model data PRD)", () => {
  it("hanya maju mengikuti alur", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "packed")).toBe(true);
    expect(canTransition("packed", "shipped")).toBe(true);
    expect(canTransition("shipped", "done")).toBe(true);
    expect(canTransition("paid", "pending_payment")).toBe(false);
    expect(canTransition("shipped", "paid")).toBe(false);
    expect(canTransition("done", "done")).toBe(false);
  });

  it("pesanan yang sudah dibayar tidak pernah kembali kedaluwarsa", () => {
    expect(canTransition("paid", "expired")).toBe(false);
    expect(canTransition("packed", "expired")).toBe(false);
    expect(canTransition("shipped", "expired")).toBe(false);
    expect(canTransition("pending_payment", "expired")).toBe(true);
  });

  it("kode pesanan 8 karakter acak dari alfabet tanpa ambigu", () => {
    const code = generateOrderCode((n) => new Uint8Array(n).fill(7));
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(isOrderStatus("pending_payment")).toBe(true);
    expect(isOrderStatus("menunggu")).toBe(false);
  });
});
