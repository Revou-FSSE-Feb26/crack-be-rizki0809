import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Di hosting seperti Railway, request masuk lewat proxy mereka. Tanpa ini,
  // semua pengunjung terbaca beralamat IP yang sama — akibatnya pembatas laju
  // menghitung mereka sebagai satu orang dan saling memblokir.
  //
  // Sengaja tidak diaktifkan di lokal: di sana tidak ada proxy, dan memercayai
  // header X-Forwarded-For berarti siapa pun bisa memalsukan alamatnya.
  if (
    process.env.TRUST_PROXY === '1' ||
    process.env.NODE_ENV === 'production'
  ) {
    app.set('trust proxy', 1);
    logger.log('Berjalan di belakang proxy: X-Forwarded-For dipercaya.');
  }

  // Header keamanan standar (HSTS, nosniff, dan kawan-kawan).
  // API ini tidak menyajikan HTML, jadi CSP-nya dimatikan agar tidak
  // mengganggu halaman dokumentasi bawaan platform hosting.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Semua endpoint diawali /api, contoh: http://localhost:3001/api/products
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Buang field yang tidak ada di DTO, dan tolak request kalau ada field asing.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Ubah payload mentah menjadi instance DTO supaya @Type() bekerja.
      transform: true,
    }),
  );

  app.enableCors({
    origin: resolveCorsOrigin(logger),
    credentials: true,
  });

  // Menutup koneksi database dengan rapi saat container dimatikan atau
  // di-restart, bukan memutusnya di tengah jalan.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Hadish Cake API siap di port ${port}, prefix /api`);
}

/**
 * Di produksi, CORS_ORIGIN yang lupa diisi adalah kesalahan konfigurasi yang
 * gejalanya membingungkan: API terlihat sehat lewat curl, tapi frontend
 * diblokir browser tanpa penjelasan. Jadi lebih baik gagal sejak awal.
 */
function resolveCorsOrigin(logger: Logger): string {
  const origin = process.env.CORS_ORIGIN;

  if (origin) return origin;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ORIGIN wajib diisi di produksi. Isi dengan URL frontend, contoh: https://hadish-cake.vercel.app',
    );
  }

  logger.warn(
    'CORS_ORIGIN belum diisi, memakai http://localhost:3000 untuk pengembangan.',
  );
  return 'http://localhost:3000';
}

void bootstrap();
