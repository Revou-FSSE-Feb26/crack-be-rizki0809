import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
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

  /** Mengubah role user. Hanya dipanggil dari endpoint khusus admin. */
  async updateRole(id: string, role: Role) {
    const user = await this.findOne(id);

    if (user.role === Role.ADMIN && role !== Role.ADMIN) {
      await this.ensureNotLastAdmin(id);
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: safeUserSelect,
    });
  }

  async remove(id: string) {
    const user = await this.findOne(id);

    if (user.role === Role.ADMIN) {
      await this.ensureNotLastAdmin(id);
    }

    // Order ikut terhapus lewat onDelete: Cascade di schema.
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User berhasil dihapus' };
  }

  /**
   * Menjaga agar selalu ada minimal satu admin. Tanpa ini, menghapus atau
   * menurunkan admin terakhir akan membuat toko tidak bisa dikelola lagi.
   */
  private async ensureNotLastAdmin(id: string) {
    const otherAdmins = await this.prisma.user.count({
      where: { role: Role.ADMIN, id: { not: id } },
    });

    if (otherAdmins === 0) {
      throw new ConflictException(
        'Ini satu-satunya akun admin yang tersisa. Buat admin lain dulu sebelum menghapus atau menurunkan akun ini.',
      );
    }
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
