// Pembuat CSV kecil (PRD Portal Admin — AD-21): UTF-8 dengan BOM agar terbaca
// benar di Excel dan Google Sheets, tanda kutip ditangani sesuai standar.

export function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
