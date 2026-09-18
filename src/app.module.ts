import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Membaca file .env dan menyediakannya ke seluruh aplikasi.
    ConfigModule.forRoot({ isGlobal: true }),
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

    // Semua endpoint tertutup secara default. Endpoint yang memang publik
    // (login, register, katalog menu) menandai dirinya dengan @Public().
    // Urutannya penting: token diverifikasi dulu, baru rolenya diperiksa.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Menyeragamkan bentuk semua response error.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
