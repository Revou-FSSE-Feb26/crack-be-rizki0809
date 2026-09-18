import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthUser, JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Mendaftarkan customer baru. Password otomatis di-hash oleh UsersService. */
  async register(dto: RegisterDto) {
    const user = await this.usersService.create({
      ...dto,
      // Role dipaksa CUSTOMER; akun ADMIN hanya dibuat lewat seed atau oleh admin lain.
      role: Role.CUSTOMER,
    });

    return this.buildAuthResponse(user);
  }

  /**
   * Memeriksa email dan password, lalu menerbitkan token.
   *
   * Pesan error sengaja dibuat sama untuk email yang tidak terdaftar maupun
   * password yang salah, supaya tidak bisa dipakai menebak email mana yang ada.
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const invalidCredentials = new UnauthorizedException(
      'Email atau password salah',
    );

    if (!user) {
      // Tetap jalankan hashing pada input agar waktu respons untuk email yang
      // tidak terdaftar tidak lebih cepat daripada email yang terdaftar.
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw invalidCredentials;
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw invalidCredentials;
    }

    return this.buildAuthResponse({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  }

  /** Data user yang sedang login, diambil ulang dari database. */
  getProfile(user: AuthUser) {
    return this.usersService.findOne(user.id);
  }

  /** Menyusun response berisi data user + token, tanpa pernah menyertakan password. */
  private buildAuthResponse(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      user,
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
    };
  }
}

/**
 * Hash bcrypt dari string acak. Tidak pernah cocok dengan password mana pun;
 * gunanya hanya menyamakan waktu pemrosesan saat email tidak ditemukan.
 */
const DUMMY_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
