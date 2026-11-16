// Area layanan (BR-05, BR-06): daftar kota/kabupaten dan batas koordinat.

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const JABODETABEK_CITIES = [
  "Kota Jakarta Pusat",
  "Kota Jakarta Selatan",
  "Kota Jakarta Barat",
  "Kota Jakarta Timur",
  "Kota Jakarta Utara",
  "Kota Depok",
  "Kota Tangerang",
  "Kota Tangerang Selatan",
  "Kota Bekasi",
  "Kota Bogor",
  "Kabupaten Tangerang",
  "Kabupaten Bekasi",
  "Kabupaten Bogor",
] as const;

export type ServiceCity = (typeof JABODETABEK_CITIES)[number];

export function isServiceCity(value: string): value is ServiceCity {
  return (JABODETABEK_CITIES as readonly string[]).includes(value);
}

export function isInServiceArea(lat: number, lng: number, bounds: GeoBounds): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
  );
}

export function boundsFromSettings(settings: Record<string, string>): GeoBounds {
  return {
    minLat: Number(settings.geo_bounds_min_lat),
    maxLat: Number(settings.geo_bounds_max_lat),
    minLng: Number(settings.geo_bounds_min_lng),
    maxLng: Number(settings.geo_bounds_max_lng),
  };
}
