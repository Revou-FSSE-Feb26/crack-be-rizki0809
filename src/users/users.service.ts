import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Jumlah putaran hashing bcrypt. 10 = standar aman dan masih cepat. */
export const BCRYPT_SALT_ROUNDS = 10;

/** Field yang boleh dikirim ke client — password sengaja tidak ada di sini. */
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Hash password sekali di satu tempat supaya konsisten dipakai register & seed. */
  static hashPassword(plain: string) {
    return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
  }

  async create(dto: CreateUserDto) {
    await this.ensureEmailAvailable(dto.email);

    return this.prisma.user.create({
      data: {
        ...dto,
        email: dto.email.toLowerCase(),
        password: await UsersService.hashPassword(dto.password),
      },
      select: safeUserSelect,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: { ...safeUserSelect, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) {
      throw new NotFoundException(`User dengan id ${id} tidak ditemukan`);
    }
    return user;
  }

  /**
   * Mengembalikan user lengkap dengan hash password.
   * Hanya dipakai internal oleh proses login, jangan dikirim ke client.
   */
  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.email) {
      await this.ensureEmailAvailable(dto.email, id);
    }

    return this.prisma.user.update({
      where: { id },
      data: dto.email ? { ...dto, email: dto.email.toLowerCase() } : dto,
      select: safeUserSelect,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Order ikut terhapus lewat onDelete: Cascade di schema.
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User berhasil dihapus' };
  }

  private async ensureEmailAvailable(email: string, exceptUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException(`Email ${email} sudah terdaftar`);
    }
  }
}
