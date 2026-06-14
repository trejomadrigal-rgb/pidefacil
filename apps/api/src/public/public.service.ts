import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getBranches(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    return this.prisma.branch.findMany({
      where: { businessId: business.id, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCategories(slug: string, branchId?: string) {
    // Only use cache when no branchId filter is applied
    const key = `public:categories:${slug}`;
    if (!branchId) {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    }

    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!business) throw new BusinessNotFoundPublicException();

    let categories = await this.prisma.category.findMany({
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
            isAvailable: true,
            variants: { select: { id: true, name: true, price: true } },
            extras: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    // Apply branch-level product availability overrides if branchId is provided
    if (branchId) {
      const overrides = await this.prisma.branchProductAvailability.findMany({
        where: { branchId },
      });
      const overrideMap = new Map(overrides.map((o) => [o.productId, o.isAvailable]));

      categories = categories.map((cat) => ({
        ...cat,
        products: cat.products.filter((p) => {
          if (overrideMap.has(p.id)) {
            return overrideMap.get(p.id);
          }
          return p.isAvailable ?? true;
        }),
      }));
    }

    const normalized = categories.map((c) => ({
      ...c,
      products: c.products.map((p) => ({
        ...p,
        price: Number(p.price),
        variants: p.variants.map((v) => ({ ...v, price: Number(v.price) })),
        extras: p.extras.map((e) => ({ ...e, price: Number(e.price) })),
      })),
    }));

    if (!branchId) {
      await this.redis.set(key, JSON.stringify(normalized), CACHE_TTL);
    }
    return normalized;
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

    const normalizedProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
      variants: p.variants.map((v) => ({ ...v, price: Number(v.price) })),
      extras: p.extras.map((e) => ({ ...e, price: Number(e.price) })),
    }));

    if (!hasFilters) {
      await this.redis.set(key, JSON.stringify(normalizedProducts), CACHE_TTL);
    }
    return normalizedProducts;
  }

  async getOrdersByPhone(slug: string, phone: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!business) throw new BusinessNotFoundPublicException();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Normalize to last 10 digits so "9991234567" matches "529991234567" etc.
    const last10 = phone.replace(/\D/g, '').slice(-10);

    const orders = await this.prisma.order.findMany({
      where: {
        businessId: business.id,
        customerPhone: { endsWith: last10 },
        createdAt: { gte: todayStart },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total),
      createdAt: o.createdAt,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    }));
  }

  async invalidateCache(slug: string): Promise<void> {
    await this.redis.del(
      `public:business:${slug}`,
      `public:categories:${slug}`,
      `public:products:${slug}`,
    );
  }
}
