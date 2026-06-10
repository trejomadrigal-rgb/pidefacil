import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { CreateExtraDto } from './dto/create-extra.dto';
import { ProductNotFoundException } from '../common/exceptions/product-not-found.exception';
import { CategoryNotFoundException } from '../common/exceptions/category-not-found.exception';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  isAvailable: true,
  isFeatured: true,
  sortOrder: true,
  categoryId: true,
  updatedAt: true,
  variants: { select: { id: true, name: true, price: true } },
  extras: { select: { id: true, name: true, price: true } },
};

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private publicService: PublicService,
  ) {}

  async findAll(businessId: string, categoryId?: string, search?: string) {
    return this.prisma.product.findMany({
      where: {
        businessId,
        ...(categoryId && { categoryId }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { sortOrder: 'asc' },
      select: PRODUCT_SELECT,
    });
  }

  async create(businessId: string, dto: CreateProductDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, businessId },
    });
    if (!category) throw new CategoryNotFoundException();

    const product = await this.prisma.product.create({
      data: { businessId, ...dto },
      select: PRODUCT_SELECT,
    });
    await this.invalidateCache(businessId);
    return product;
  }

  async update(businessId: string, id: string, dto: UpdateProductDto) {
    await this.findOneOrFail(businessId, id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, businessId },
      });
      if (!category) throw new CategoryNotFoundException();
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      select: PRODUCT_SELECT,
    });
    await this.invalidateCache(businessId);
    return product;
  }

  async toggleAvailability(businessId: string, id: string) {
    const product = await this.findOneOrFail(businessId, id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isAvailable: !product.isAvailable },
      select: { id: true, name: true, isAvailable: true },
    });
    await this.invalidateCache(businessId);
    return updated;
  }

  async remove(businessId: string, id: string) {
    await this.findOneOrFail(businessId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.extra.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });
    await this.invalidateCache(businessId);
  }

  async addVariant(businessId: string, productId: string, dto: CreateVariantDto) {
    await this.findOneOrFail(businessId, productId);
    return this.prisma.variant.create({
      data: { productId, ...dto },
    });
  }

  async removeVariant(businessId: string, productId: string, variantId: string) {
    await this.findOneOrFail(businessId, productId);
    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new ProductNotFoundException();
    await this.prisma.variant.delete({ where: { id: variantId } });
  }

  async addExtra(businessId: string, productId: string, dto: CreateExtraDto) {
    await this.findOneOrFail(businessId, productId);
    return this.prisma.extra.create({
      data: { productId, ...dto },
    });
  }

  async removeExtra(businessId: string, productId: string, extraId: string) {
    await this.findOneOrFail(businessId, productId);
    const extra = await this.prisma.extra.findFirst({
      where: { id: extraId, productId },
    });
    if (!extra) throw new ProductNotFoundException();
    await this.prisma.extra.delete({ where: { id: extraId } });
  }

  private async findOneOrFail(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new ProductNotFoundException();
    return product;
  }

  private async invalidateCache(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { slug: true },
    });
    await this.publicService.invalidateCache(business.slug);
  }
}
