// Konfigurasi Prisma CLI (Prisma 7). Sejak versi 7, URL koneksi database dan
// perintah seed tidak lagi ditulis di schema.prisma / package.json, tapi di sini.
import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS","moduleResolution":"node"} prisma/seed.ts',
  },
});
