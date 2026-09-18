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

      default:
        this.logger.warn(
          `Kode error Prisma yang belum ditangani khusus: ${exception.code}`,
        );
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Database menolak operasi ini',
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
