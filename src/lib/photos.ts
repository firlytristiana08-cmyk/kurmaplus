// Foto produk — tiga tingkat ukuran responsif (600/1200/1600px) untuk srcset.
// Modul ini murni tanpa dependensi server supaya bisa dipakai komponen,
// endpoint, dan tes.

export interface PhotoTiers {
  /** Turunan 600px — kosong bila tidak perlu (foto asli lebih kecil). */
  sm: string;
  /** Turunan 1200px — kosong bila tidak perlu. */
  md: string;
  /** Ukuran terbesar (maks 1600px) — disimpan di kolom data. */
  lg: string;
}

/** URL foto; beri w untuk meminta tingkat ukuran tertentu. */
export function photoSrc(id: number, w?: number): string {
  return w ? `/api/foto/${id}?w=${w}` : `/api/foto/${id}`;
}

/** Nilai srcset untuk <img> — browser memilih otomatis sesuai layar. */
export function photoSrcset(id: number): string {
  return [600, 1200, 1600].map((w) => `${photoSrc(id, w)} ${w}w`).join(", ");
}

/**
 * Pilih nilai foto untuk lebar permintaan: turunan 600px (atau 1200px bila
 * turunan kecil tidak ada), selain itu ukuran terbesar. Foto lama tanpa
 * turunan selalu jatuh ke ukuran terbesar.
 */
export function pickPhotoTier(
  data: string,
  dataSm: string | null | undefined,
  dataMd: string | null | undefined,
  w: number,
): string {
  if (w > 0 && w <= 600 && dataSm) return dataSm;
  if (w > 0 && w <= 1200 && dataMd) return dataMd;
  return data;
}

/** Terima masukan form: JSON PhotoTiers atau string foto lama apa adanya. */
export function parsePhotoInput(raw: string): PhotoTiers {
  const v = raw.trim();
  if (v.startsWith("{")) {
    try {
      const parsed = JSON.parse(v) as Partial<PhotoTiers>;
      return {
        sm: String(parsed.sm ?? ""),
        md: String(parsed.md ?? ""),
        lg: String(parsed.lg ?? ""),
      };
    } catch {
      return { sm: "", md: "", lg: v };
    }
  }
  return { sm: "", md: "", lg: v };
}
