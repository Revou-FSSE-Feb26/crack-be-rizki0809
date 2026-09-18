import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

/**
 * Menyalakan aplikasi persis seperti di main.ts — prefix /api, ValidationPipe,
 * plus guard & exception filter global yang terdaftar di AppModule — supaya
 * yang diuji benar-benar perilaku produksi, bukan versi yang dipermudah.
 */
export type TestApp = INestApplication<App>;

export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

/** Akun-akun yang dibuat oleh prisma/seed.ts. */
export const SEED_ACCOUNTS = {
  admin: { email: 'admin@hadishcake.com', password: 'Admin123!' },
  siti: { email: 'siti@example.com', password: 'Customer123!' },
  budi: { email: 'budi@example.com', password: 'Customer123!' },
} as const;

export interface LoggedInUser {
  token: string;
  id: string;
}

/** Login lalu kembalikan token beserta id usernya. */
export async function login(
  app: TestApp,
  account: { email: string; password: string },
): Promise<LoggedInUser> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send(account)
    .expect(200);

  const body = response.body as {
    accessToken: string;
    user: { id: string };
  };

  return { token: body.accessToken, id: body.user.id };
}

/** Tanggal "YYYY-MM-DD" relatif terhadap hari ini. */
export function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Bentuk body error yang dihasilkan AllExceptionsFilter. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
