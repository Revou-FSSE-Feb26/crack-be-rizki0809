import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Hadish Cake API berjalan di http://localhost:${port}/api`);
}
void bootstrap();
