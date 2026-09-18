import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Kategori "${dto.slug}" sudah ada`);
    }

    return this.prisma.category.create({ data: dto });
  }

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Kategori dengan id ${id} tidak ditemukan`);
    }
    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        products: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Kategori "${slug}" tidak ditemukan`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    if (dto.slug) {
      const duplicate = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Kategori "${dto.slug}" sudah dipakai kategori lain`,
        );
      }
    }

    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Kategori tidak boleh hilang selama masih ada menu di dalamnya,
    // supaya tidak ada produk yang kehilangan induknya.
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Kategori masih dipakai ${productCount} menu. Pindahkan atau hapus menunya dulu.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Kategori berhasil dihapus' };
  }
}
