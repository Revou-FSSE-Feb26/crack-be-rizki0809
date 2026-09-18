import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    await this.ensureCategoryExists(dto.categoryId);

    return this.prisma.product.create({
      data: dto,
      include: { category: true },
    });
  }

  async findAll(query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const includeUnavailable = query.includeUnavailable === 'true';

    // Menu yang sudah dihapus tidak pernah tampil di listing mana pun.
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (!includeUnavailable) {
      where.isAvailable = true;
    }
    if (query.category) {
      where.category = { slug: query.category };
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.bestSeller) {
      where.bestSeller = query.bestSeller === 'true';
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ bestSeller: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Menu dengan id ${id} tidak ditemukan`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  /**
   * Menghapus menu. Kalau menu belum pernah dipesan, barisnya benar-benar dihapus.
   * Kalau sudah pernah masuk order, menu hanya di-soft delete supaya history
   * order lama tetap utuh dan tidak ada order yang kehilangan produknya.
   */
  async remove(id: string) {
    await this.findOne(id);

    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount === 0) {
      await this.prisma.product.delete({ where: { id } });
      return { message: 'Menu berhasil dihapus' };
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isAvailable: false },
    });
    return {
      message: `Menu diarsipkan karena sudah dipakai di ${orderItemCount} order. Menu tidak lagi tampil di katalog, tapi history order tetap utuh.`,
    };
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(
        `Kategori dengan id ${categoryId} tidak ditemukan`,
      );
    }
  }
}
