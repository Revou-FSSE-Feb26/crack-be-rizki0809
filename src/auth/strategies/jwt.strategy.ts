import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, JwtPayload } from '../types/jwt-payload.type';

/**
 * Membaca token dari header `Authorization: Bearer <token>`, memverifikasi
 * tanda tangannya, lalu mengubah isinya menjadi data user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Dipanggil otomatis setelah tanda tangan token valid. Nilai yang
   * dikembalikan di sini akan tersedia sebagai `request.user`.
   *
   * User tetap dicek ke database supaya token milik akun yang sudah dihapus
   * atau yang rolenya sudah diturunkan tidak bisa dipakai lagi.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Akun tidak ditemukan atau sudah dihapus',
      );
    }

    return user;
  }
}
