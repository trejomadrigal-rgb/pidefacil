import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryNotFoundException } from '../common/exceptions/category-not-found.exception';
import { CategoryHasProductsException } from '../common/exceptions/category-has-products.exception';
import { MenuNotFoundException } from '../common/exceptions/menu-not-found.exception';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private publicService: PublicService,
  ) {}

  async findAll(businessId: string, menuId?: string) {
    return this.prisma.category.findMany({
      where: { businessId, ...(menuId && { menuId }) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(businessId: string, dto: CreateCategoryDto) {
    if (dto.menuId) {
      const menu = await this.prisma.menu.findFirst({
        where: { id: dto.menuId, businessId },
      });
      if (!menu) throw new MenuNotFoundException();
    }
    const category = await this.prisma.category.create({
      data: { businessId, ...dto },
    });
    await this.invalidateCache(businessId);
    return category;
  }

  async update(businessId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOneOrFail(businessId, id);
    const category = await this.prisma.category.update({ where: { id }, data: dto });
    await this.invalidateCache(businessId);
    return category;
  }

  async remove(businessId: string, id: string) {
    await this.findOneOrFail(businessId, id);
    const activeCount = await this.prisma.product.count({
      where: { categoryId: id, isAvailable: true },
    });
    if (activeCount > 0) throw new CategoryHasProductsException();
    await this.prisma.category.delete({ where: { id } });
    await this.invalidateCache(businessId);
  }

  private async findOneOrFail(businessId: string, id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, businessId } });
    if (!cat) throw new CategoryNotFoundException();
    return cat;
  }

  private async invalidateCache(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { slug: true },
    });
    await this.publicService.invalidateCache(business.slug);
  }
}
