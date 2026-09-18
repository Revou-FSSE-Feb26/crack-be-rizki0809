import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Satu koneksi Prisma yang dipakai bersama oleh seluruh service.
 * Connect saat aplikasi start, disconnect saat aplikasi berhenti.
 *
 * Sejak Prisma 7, koneksi database dibuat lewat driver adapter (di sini
 * PrismaPg untuk PostgreSQL), bukan lagi dari url di dalam schema.prisma.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi koneksi database.',
      );
    }

    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
