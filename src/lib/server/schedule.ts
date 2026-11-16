// Jadwal kirim (BR-01..BR-04): murni berbasis waktu, wajib bertes.
// Zona Asia/Jakarta adalah UTC+7 tetap tanpa DST, jadi cukup digeser 7 jam
// lalu memakai pembaca UTC (determinis untuk pengujian).

export interface DeliveryOption {
  date: string;
  weekdayName: "Sabtu" | "Minggu";
  isFull: boolean;
}

export interface ScheduleSettings {
  cutoffWeekday: number;
  cutoffTime: string;
  dailyCapacity: number;
  booked: Record<string, number>;
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const JAKARTA_OFFSET_MS = 7 * MS_PER_HOUR;

function jakartaShifted(now: Date): Date {
  return new Date(now.getTime() + JAKARTA_OFFSET_MS);
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// BR-02: pesanan sebelum batas (Kamis 23.59 usulan) masuk akhir pekan ini,
// setelahnya masuk akhir pekan berikutnya. BR-03: dua tanggal terdekat.
export function upcomingDeliveryDates(now: Date, settings: ScheduleSettings): DeliveryOption[] {
  const local = jakartaShifted(now);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const [hourText, minuteText] = settings.cutoffTime.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("cutoffTime harus berformat HH:MM");
  }
  const cutoffIndex = settings.cutoffWeekday - 1;
  const cutoffMoment = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday + cutoffIndex,
    hour,
    minute,
  );
  const cutoffPassed = local.getTime() > cutoffMoment;
  const shiftDays = cutoffPassed ? 7 : 0;
  const mondayDate = local.getUTCDate() - daysSinceMonday;

  const saturday = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), mondayDate + 5 + shiftDays),
  );
  const sunday = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), mondayDate + 6 + shiftDays),
  );

  return [
    {
      date: isoDate(saturday),
      weekdayName: "Sabtu",
      isFull: (settings.booked[isoDate(saturday)] ?? 0) >= settings.dailyCapacity,
    },
    {
      date: isoDate(sunday),
      weekdayName: "Minggu",
      isFull: (settings.booked[isoDate(sunday)] ?? 0) >= settings.dailyCapacity,
    },
  ];
}

// BR-03: hanya tanggal Sabtu/Minggu yang ditawarkan sistem yang sah.
export function isDeliverableDate(date: string, options: DeliveryOption[]): boolean {
  return options.some((option) => option.date === date && !option.isFull);
}

// BR-12: batas waktu bayar dalam menit sejak pesanan dibuat.
export function expiresAt(now: Date, paymentTimeoutMinutes: number): Date {
  if (!Number.isInteger(paymentTimeoutMinutes) || paymentTimeoutMinutes < 1) {
    throw new Error("Batas waktu bayar minimal 1 menit");
  }
  return new Date(now.getTime() + paymentTimeoutMinutes * 60_000);
}

export function msUntil(target: Date, now: Date): number {
  return target.getTime() - now.getTime();
}

export { MS_PER_DAY, MS_PER_HOUR };
