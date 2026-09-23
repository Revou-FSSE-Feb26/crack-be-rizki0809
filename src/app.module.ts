import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  GLOBAL_THROTTLE_LIMIT,
  THROTTLE_TTL_MS,
} from './common/throttle.config';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Membaca file .env dan menyediakannya ke seluruh aplikasi.
    ConfigModule.forRoot({ isGlobal: true }),

    // Membatasi jumlah request per alamat IP, supaya satu pengirim tidak bisa
    // membanjiri server atau menebak password tanpa henti.
    ThrottlerModule.forRoot([
      { ttl: THROTTLE_TTL_MS, limit: GLOBAL_THROTTLE_LIMIT },
    ]),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    UsersModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Urutan guard mengikuti urutan pendaftaran. Pembatas laju ditaruh
    // paling depan supaya banjir request ditolak sebelum menyentuh database.
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Semua endpoint tertutup secara default. Endpoint yang memang publik
    // (login, register, katalog menu) menandai dirinya dengan @Public().
    // Token diverifikasi dulu, baru rolenya diperiksa.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Menyeragamkan bentuk semua response error.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
