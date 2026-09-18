/**
 * Aturan toko: booking paling lambat 1 hari sebelum kue diambil.
 * Artinya tanggal pengambilan paling cepat adalah H+1 dari hari ini.
 */
export const MIN_PICKUP_DAYS_AHEAD = 1;

/**
 * Tanggal pengambilan disimpan sebagai tanggal saja (tanpa jam). Semua Date di
 * sini dibuat pada tengah malam UTC supaya nilainya tidak bergeser sehari
 * gara-gara perbedaan timezone antara server dan database.
 */
export function toDateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Ubah string "2026-09-20" menjadi Date. Mengembalikan null kalau tanggalnya tidak masuk akal. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, y, m, d] = match;
  const date = toDateOnly(Number(y), Number(m), Number(d));

  // Menangkap tanggal palsu seperti "2026-02-31" yang di-rollover oleh Date.
  const valid =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d);

  return valid ? date : null;
}

/** Hari ini menurut jam server, dinormalkan ke tengah malam UTC. */
export function startOfToday(): Date {
  const now = new Date();
  return toDateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Tanggal pengambilan paling awal yang masih boleh dipesan. */
export function earliestPickupDate(): Date {
  const date = startOfToday();
  date.setUTCDate(date.getUTCDate() + MIN_PICKUP_DAYS_AHEAD);
  return date;
}

/** Format Date menjadi "YYYY-MM-DD" untuk ditampilkan di pesan error. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
