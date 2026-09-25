import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/** Batas bawah error yang berarti kesalahan di sisi server. */
const SERVER_ERROR_FROM: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** Bentuk body error yang sama untuk seluruh endpoint. */
interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/** Hasil penerjemahan sebuah exception menjadi response HTTP. */
interface DescribedError {
  status: number;
  error: string;
  message: string | string[];
}

/**
 * Menangkap SEMUA error yang keluar dari endpoint mana pun, lalu mengubahnya
 * menjadi satu bentuk response yang konsisten.
 *
 * Tujuannya dua: client cukup menangani satu bentuk error, dan detail internal
 * (stack trace, query SQL, nama kolom) tidak pernah bocor ke client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.describe(exception);

    // Error 5xx berarti ada yang salah di sisi kita, jadi harus tercatat di log
    // lengkap dengan stack trace-nya. Error 4xx cukup dibalas ke client.
    if (status >= SERVER_ERROR_FROM) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private describe(exception: unknown): DescribedError {
    // Error yang memang sengaja dilempar service, misalnya NotFoundException.
    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrismaError(exception);
    }

    // Gagal menyambung ke database sama sekali: DATABASE_URL salah, password
    // belum di-URL-encode, kurang sslmode, atau memakai connection string
    // yang tidak bisa dijangkau dari hosting.
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error(
        `Tidak bisa terhubung ke database (${exception.errorCode ?? 'tanpa kode'}). ` +
          `Periksa DATABASE_URL. Detail: ${exception.message}`,
      );
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'Server belum bisa terhubung ke database. Coba lagi nanti.',
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Data yang dikirim tidak sesuai dengan struktur database',
      };
    }

    // CHECK constraint di database (lihat migrasi add_data_integrity_constraints).
    if (isCheckConstraintViolation(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Data ditolak karena melanggar aturan yang dijaga database',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan di server. Silakan coba lagi.',
    };
  }

  private describeHttpException(exception: HttpException): DescribedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { status, error: exception.name, message: payload };
    }

    const body = payload as { message?: string | string[]; error?: string };

    return {
      status,
      error: body.error ?? exception.name,
      // ValidationPipe mengirim array berisi semua pesan validasi sekaligus.
      message: body.message ?? exception.message,
    };
  }

  private describePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): DescribedError {
    switch (exception.code) {
      // Kode P1xxx berarti masalah koneksi ke database, bukan kesalahan
      // pengirim request. Membalasnya sebagai 4xx akan menyesatkan: pengguna
      // mengira inputnya salah, padahal servernya yang belum nyambung.
      case 'P1000': // autentikasi database ditolak
      case 'P1001': // server database tidak terjangkau
      case 'P1002': // server database tidak menjawab tepat waktu
      case 'P1011': // gagal membuka koneksi TLS
      case 'P1017': // koneksi ditutup sepihak oleh server
        this.logger.error(
          `Gagal terhubung ke database (${exception.code}). ` +
            'Periksa DATABASE_URL: host, kredensial, dan pengaturan sslmode. ' +
            `Detail: ${exception.message}`,
        );
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: 'Server belum bisa terhubung ke database. Coba lagi nanti.',
        };

      // Melanggar unique constraint.
      case 'P2002': {
        const target = exception.meta?.target;
        const field = Array.isArray(target) ? target.join(', ') : 'data';
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: `Nilai ${field} sudah dipakai data lain`,
        };
      }

      // Baris yang dituju tidak ada.
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Data yang dituju tidak ditemukan',
        };

      // Melanggar foreign key: induknya tidak ada, atau masih dipakai data lain.
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message:
            'Data yang direferensikan tidak ada, atau masih dipakai data lain',
        };

      // Nilai terlalu panjang untuk kolomnya.
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Nilai yang dikirim terlalu panjang untuk kolomnya',
        };

      // Tabel atau kolomnya tidak ada. Hampir selalu berarti migrasi belum
      // dijalankan di database ini, atau DATABASE_URL menunjuk database lain.
      case 'P2021':
      case 'P2022':
        this.logger.error(
          `Struktur database tidak sesuai (${exception.code}). ` +
            'Jalankan `prisma migrate deploy`, dan pastikan DATABASE_URL ' +
            `menunjuk database yang benar. Detail: ${exception.message}`,
        );
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Server sedang bermasalah. Coba lagi sebentar lagi.',
        };

      default:
        // Sengaja dicatat sebagai error, bukan warning: kode yang belum
        // dikenali berarti ada yang perlu diperiksa, bukan sekadar catatan.
        this.logger.error(
          `Kode error Prisma yang belum ditangani khusus: ${exception.code}. ` +
            `Detail: ${exception.message}`,
        );
        // Selama belum jelas ini salah siapa, jangan menyalahkan pengirim
        // request. 400 membuat masalah server terlihat seperti salah input.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Server sedang bermasalah. Coba lagi sebentar lagi.',
        };
    }
  }
}

/**
 * PostgreSQL menolak baris yang melanggar CHECK constraint dengan SQLSTATE 23514.
 * Error ini bisa sampai ke sini dalam beberapa bentuk pembungkus, jadi
 * pendeteksiannya dilakukan lewat isi pesannya.
 */
function isCheckConstraintViolation(exception: unknown): boolean {
  if (!(exception instanceof Error)) return false;

  const message = exception.message.toLowerCase();
  return (
    message.includes('violates check constraint') || message.includes('23514')
  );
}
