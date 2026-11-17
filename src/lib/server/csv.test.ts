import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv (AD-21): ekspor UTF-8 + BOM", () => {
  it("memulai dengan BOM dan baris CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toBe("\uFEFFa,b\r\n1,2\r\n");
  });

  it("membungkus sel dengan tanda kutip, koma, atau baris baru", () => {
    expect(csvCell('Jl. "Merdeka" 1')).toBe('"Jl. ""Merdeka"" 1"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("baris1\nbaris2")).toBe('"baris1\nbaris2"');
    expect(csvCell(12000)).toBe("12000");
    expect(csvCell(null)).toBe("");
  });
});
