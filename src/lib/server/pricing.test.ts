import { describe, expect, it } from "vitest";
import { lineTotalIdr, PricingError, subtotalIdr, totalIdr } from "./pricing";

describe("pricing (BR-10)", () => {
  it("menjumlahkan subtotal dalam rupiah bulat", () => {
    expect(
      subtotalIdr([
        { priceIdr: 68000, qty: 2 },
        { priceIdr: 135000, qty: 1 },
      ]),
    ).toBe(271000);
  });

  it("total sama dengan subtotal tanpa ongkir dan pajak", () => {
    expect(totalIdr(271000)).toBe(271000);
    expect(totalIdr(0)).toBe(0);
  });

  it("menolak harga yang bukan bilangan bulat", () => {
    expect(() => lineTotalIdr({ priceIdr: 68000.5, qty: 1 })).toThrow(PricingError);
    expect(() => totalIdr(-1)).toThrow(PricingError);
  });

  it("menolak jumlah di bawah 1 dan keranjang kosong", () => {
    expect(() => lineTotalIdr({ priceIdr: 1000, qty: 0 })).toThrow(PricingError);
    expect(() => subtotalIdr([])).toThrow(PricingError);
  });
});
