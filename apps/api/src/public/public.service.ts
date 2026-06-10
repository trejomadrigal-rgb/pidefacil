import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BusinessNotFoundPublicException } from '../common/exceptions/business-not-found-public.exception';

const CACHE_TTL = 300;

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getBusiness(slug: string) {
    const key = `public:business:${slug}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, phone: true, logoUrl: true, address: true },
    });
    if (!business) throw new BusinessNotFoundPublicException();

    await this.redis.set(key, JSON.stringify(business), CACHE_TTL);
    return business;
  }

  async getCategories(slug: string) {
    const key = `public:categories:${slug}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!business) throw new BusinessNotFoundPublicException();

    const categories = await this.prisma.category.findMany({
      where: { businessId: business.id, status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        products: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            isFeatured: true,
            variants: { select: { id: true, name: true, price: true } },
            extras: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    await this.redis.set(key, JSON.stringify(categories), CACHE_TTL);
    return categories;
  }

  async getProducts(slug: string, categoryId?: string, search?: string) {
    const key = `public:products:${slug}`;
    const hasFilters = Boolean(categoryId || search);

    if (!hasFilters) {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    }

    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!business) throw new BusinessNotFoundPublicException();

    const products = await this.prisma.product.findMany({
      where: {
        businessId: business.id,
        isAvailable: true,
        ...(categoryId && { categoryId }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isFeatured: true,
        categoryId: true,
        variants: { select: { id: true, name: true, price: true } },
        extras: { select: { id: true, name: true, price: true } },
      },
    });

    if (!hasFilters) {
      await this.redis.set(key, JSON.stringify(products), CACHE_TTL);
    }
    return products;
  }

  async invalidateCache(slug: string): Promise<void> {
    await this.redis.del(
      `public:business:${slug}`,
      `public:categories:${slug}`,
      `public:products:${slug}`,
    );
  }
}
