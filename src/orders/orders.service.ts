import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  earliestPickupDate,
  formatDateOnly,
  parseDateOnly,
} from '../common/utils/pickup-date.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdatePickupDateDto } from './dto/update-pickup-date.dto';

/** Relasi yang selalu ikut dikirim bersama order. */
const orderInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  items: {
    include: {
      product: {
        select: { id: true, name: true, emoji: true, tone: true, price: true },
      },
    },
  },
} satisfies Prisma.OrderInclude;

/** Bentuk order lengkap beserta relasinya, seperti yang dikirim ke client. */
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

/**
 * Perpindahan status yang diizinkan. Status akhir (COMPLETED & CANCELLED)
 * sengaja tidak punya tujuan lagi supaya history order tidak bisa diputar balik.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Status yang datanya masih boleh diubah customer. */
const EDITABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const pickupDate = this.validatePickupDate(dto.pickupDate);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new BadRequestException(
        `User dengan id ${dto.userId} tidak ditemukan`,
      );
    }

    const items = await this.buildOrderItems(dto.items);
    const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);

    return this.createWithUniqueOrderNumber({
      userId: dto.userId,
      pickupDate,
      totalPrice,
      notes: dto.notes,
      items: { create: items },
    });
  }

  async findAll(query: QueryOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.pickupDate) {
      where.pickupDate = this.parseOrThrow(query.pickupDate);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) {
      throw new NotFoundException(`Order dengan id ${id} tidak ditemukan`);
    }
    return order;
  }

  /** History order milik satu customer. */
  findByUser(userId: string, query: QueryOrderDto) {
    return this.findAll({ ...query, userId });
  }

  /** Customer mengganti tanggal pengambilan kue. */
  async updatePickupDate(id: string, dto: UpdatePickupDateDto) {
    const order = await this.findOne(id);

    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Tanggal pengambilan tidak bisa diubah karena order sudah berstatus ${order.status}`,
      );
    }

    const pickupDate = this.validatePickupDate(dto.pickupDate);

    return this.prisma.order.update({
      where: { id },
      data: { pickupDate },
      include: orderInclude,
    });
  }

  /** Admin mengatur status orderan. */
  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    if (order.status === dto.status) {
      return order;
    }

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      const hint = allowed.length
        ? `Dari ${order.status} hanya bisa ke: ${allowed.join(', ')}.`
        : `Status ${order.status} sudah final dan tidak bisa diubah lagi.`;
      throw new BadRequestException(
        `Tidak bisa mengubah status dari ${order.status} ke ${dto.status}. ${hint}`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: orderInclude,
    });
  }

  /** Customer membatalkan ordernya sendiri. */
  async cancel(id: string) {
    const order = await this.findOne(id);

    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Order berstatus ${order.status} tidak bisa dibatalkan`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: orderInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Item ikut terhapus lewat onDelete: Cascade di schema.
    await this.prisma.order.delete({ where: { id } });
    return { message: 'Order berhasil dihapus' };
  }

  /**
   * Memastikan tanggal pengambilan valid dan memenuhi aturan toko:
   * booking paling lambat 1 hari sebelum hari pengambilan.
   */
  private validatePickupDate(value: string): Date {
    const pickupDate = this.parseOrThrow(value);
    const earliest = earliestPickupDate();

    if (pickupDate.getTime() < earliest.getTime()) {
      throw new BadRequestException(
        `Booking paling lambat 1 hari sebelum pengambilan. Tanggal pengambilan paling cepat adalah ${formatDateOnly(earliest)}.`,
      );
    }

    return pickupDate;
  }

  private parseOrThrow(value: string): Date {
    const date = parseDateOnly(value);
    if (!date) {
      throw new BadRequestException(`Tanggal "${value}" tidak valid`);
    }
    return date;
  }

  /**
   * Menyiapkan item order sekaligus mengunci harga saat ini sebagai unitPrice,
   * supaya total order lama tidak ikut berubah kalau admin mengganti harga menu.
   */
  private async buildOrderItems(items: CreateOrderDto['items']) {
    const productIds = items.map((item) => item.productId);

    const duplicate = productIds.find(
      (id, index) => productIds.indexOf(id) !== index,
    );
    if (duplicate) {
      throw new BadRequestException(
        `Menu dengan id ${duplicate} dikirim lebih dari sekali. Gabungkan menjadi satu item dengan quantity yang dijumlahkan.`,
      );
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
    });

    const found = new Map(products.map((product) => [product.id, product]));

    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `Menu berikut tidak ditemukan: ${missing.join(', ')}`,
      );
    }

    const unavailable = products.filter((product) => !product.isAvailable);
    if (unavailable.length) {
      throw new BadRequestException(
        `Menu berikut sedang tidak tersedia: ${unavailable
          .map((product) => product.name)
          .join(', ')}`,
      );
    }

    return items.map((item) => {
      const product = found.get(item.productId)!;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: product.price * item.quantity,
      };
    });
  }

  /**
   * Nomor order dibuat acak, jadi ada kemungkinan kecil bentrok dengan yang
   * sudah ada. Kalau database menolak karena duplikat (P2002), coba lagi.
   */
  private async createWithUniqueOrderNumber(
    data: Omit<Prisma.OrderUncheckedCreateInput, 'orderNumber'>,
    attempt = 0,
  ): Promise<OrderWithRelations> {
    try {
      return await this.prisma.order.create({
        data: { ...data, orderNumber: generateOrderNumber() },
        include: orderInclude,
      });
    } catch (error) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';

      if (isDuplicate && attempt < 5) {
        return this.createWithUniqueOrderNumber(data, attempt + 1);
      }
      throw error;
    }
  }
}

/** Huruf/angka yang mudah dibaca — tanpa I, O, 0, 1 supaya tidak salah baca. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Contoh hasil: "HC-20260918-A3F1". */
function generateOrderNumber(): string {
  const today = formatDateOnly(new Date()).replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `HC-${today}-${suffix}`;
}
