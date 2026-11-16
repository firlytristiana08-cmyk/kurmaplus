import { describe, expect, it } from "vitest";
import { expiresAt, isDeliverableDate, upcomingDeliveryDates } from "./schedule";

const base = {
  cutoffWeekday: 4,
  cutoffTime: "23:59",
  dailyCapacity: 2,
  booked: {},
};

// Zona waktu diuji langsung: input UTC, hasil tanggal Asia/Jakarta.
describe("schedule (BR-01..BR-04)", () => {
  it("sebelum batas Kamis 23.59 WIB → akhir pekan ini", () => {
    // Rabu 11 November 2026 17.00 WIB
    const now = new Date("2026-11-11T10:00:00Z");
    const options = upcomingDeliveryDates(now, base);
    expect(options.map((o) => o.date)).toEqual(["2026-11-14", "2026-11-15"]);
    expect(options.map((o) => o.weekdayName)).toEqual(["Sabtu", "Minggu"]);
  });

  it("setelah batas → akhir pekan berikutnya", () => {
    // Jumat 13 November 2026 09.00 WIB
    const now = new Date("2026-11-13T02:00:00Z");
    const options = upcomingDeliveryDates(now, base);
    expect(options.map((o) => o.date)).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("pesan di hari Minggu masuk akhir pekan berikutnya", () => {
    // Minggu 15 November 2026 12.00 WIB
    const now = new Date("2026-11-15T05:00:00Z");
    const options = upcomingDeliveryDates(now, base);
    expect(options.map((o) => o.date)).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("tanggal yang sudah penuh ditandai dan tidak bisa dipilih", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    const options = upcomingDeliveryDates(now, {
      ...base,
      booked: { "2026-11-14": 2 },
    });
    expect(options[0]?.isFull).toBe(true);
    expect(isDeliverableDate("2026-11-14", options)).toBe(false);
    expect(isDeliverableDate("2026-11-15", options)).toBe(true);
    expect(isDeliverableDate("2026-11-16", options)).toBe(false);
  });

  it("batas waktu bayar dihitung dari waktu pesanan dibuat", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    expect(expiresAt(now, 60).toISOString()).toBe("2026-11-11T11:00:00.000Z");
    expect(() => expiresAt(now, 0)).toThrow();
  });
});
