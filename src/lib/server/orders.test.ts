import { describe, expect, it } from "vitest";
import { generateOrderCode, isOrderStatus } from "./orders";

describe("status pesanan (Model data PRD)", () => {
  it("kode pesanan 8 karakter acak dari alfabet tanpa ambigu", () => {
    const code = generateOrderCode((n) => new Uint8Array(n).fill(7));
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(isOrderStatus("pending_payment")).toBe(true);
    expect(isOrderStatus("menunggu")).toBe(false);
  });
});
