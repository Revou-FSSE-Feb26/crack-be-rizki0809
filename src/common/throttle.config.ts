/**
 * Pengaturan pembatasan laju request (rate limit).
 *
 * Saat menjalankan test, batasnya dibuat sangat longgar. Tanpa ini, rangkaian
 * integration test yang berkali-kali login dari alamat yang sama akan kena
 * batas dan gagal karena 429 — bukan karena kodenya salah.
 */
const isTest = process.env.NODE_ENV === 'test';

/** Jendela waktu perhitungan, dalam milidetik. */
export const THROTTLE_TTL_MS = 60_000;

/** Batas umum untuk seluruh endpoint, per alamat IP per menit. */
export const GLOBAL_THROTTLE_LIMIT = isTest
  ? 100_000
  : Number(process.env.THROTTLE_LIMIT ?? 120);

/**
 * Batas khusus login dan register. Jauh lebih ketat karena endpoint inilah
 * yang dipakai menebak password secara berulang.
 */
export const AUTH_THROTTLE_LIMIT = isTest
  ? 100_000
  : Number(process.env.AUTH_THROTTLE_LIMIT ?? 10);
