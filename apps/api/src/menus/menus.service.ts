import { Injectable } from '@nestjs/common';
import { MenuStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuNotFoundException } from '../common/exceptions/menu-not-found.exception';
import { MenuNotPublishableException } from '../common/exceptions/menu-not-publishable.exception';
import { MenuNotDeletableException } from '../common/exceptions/menu-not-deletable.exception';

@Injectable()
export class MenusService {
  constructor(
    private prisma: PrismaService,
    private publicService: PublicService,
  ) {}

  async findAll(businessId: string) {
    return this.prisma.menu.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(businessId: string, dto: CreateMenuDto) {
    return this.prisma.menu.create({
      data: { businessId, ...dto },
    });
  }

  async update(businessId: string, id: string, dto: UpdateMenuDto) {
    await this.findOneOrFail(businessId, id);
    return this.prisma.menu.update({ where: { id }, data: dto });
  }

  async publish(businessId: string, id: string) {
    await this.findOneOrFail(businessId, id);

    const productCount = await this.prisma.product.count({
      where: { isAvailable: true, category: { menuId: id, businessId } },
    });
    if (productCount === 0) throw new MenuNotPublishableException();

    const menu = await this.prisma.menu.update({
      where: { id },
      data: { status: MenuStatus.PUBLISHED, publishedAt: new Date() },
    });

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { slug: true },
    });
    await this.publicService.invalidateCache(business.slug);
    return menu;
  }

  async duplicate(businessId: string, id: string) {
    const source = await this.prisma.menu.findFirst({
      where: { id, businessId },
      include: {
        categories: {
          include: {
            products: {
              include: { variants: true, extras: true },
            },
          },
        },
      },
    });
    if (!source) throw new MenuNotFoundException();

    return this.prisma.$transaction(async (tx) => {
      const newMenu = await tx.menu.create({
        data: {
          businessId,
          name: `${source.name} (copia)`,
          type: source.type,
          startDate: source.startDate,
          endDate: source.endDate,
          status: MenuStatus.DRAFT,
        },
      });

      for (const cat of source.categories) {
        const newCat = await tx.category.create({
          data: {
            businessId,
            menuId: newMenu.id,
            name: cat.name,
            sortOrder: cat.sortOrder,
            status: cat.status,
          },
        });
        for (const prod of cat.products) {
          const newProd = await tx.product.create({
            data: {
              businessId,
              categoryId: newCat.id,
              name: prod.name,
              description: prod.description,
              price: prod.price,
              imageUrl: prod.imageUrl,
              isFeatured: prod.isFeatured,
              sortOrder: prod.sortOrder,
            },
          });
          for (const v of prod.variants) {
            await tx.variant.create({
              data: { productId: newProd.id, name: v.name, price: v.price },
            });
          }
          for (const e of prod.extras) {
            await tx.extra.create({
              data: { productId: newProd.id, name: e.name, price: e.price },
            });
          }
        }
      }

      return newMenu;
    });
  }

  async remove(businessId: string, id: string) {
    const menu = await this.findOneOrFail(businessId, id);
    if (menu.status === MenuStatus.PUBLISHED) throw new MenuNotDeletableException();
    await this.prisma.$transaction(async (tx) => {
      await tx.category.updateMany({ where: { menuId: id }, data: { menuId: null } });
      await tx.menu.delete({ where: { id } });
    });
  }

  private async findOneOrFail(businessId: string, id: string) {
    const menu = await this.prisma.menu.findFirst({ where: { id, businessId } });
    if (!menu) throw new MenuNotFoundException();
    return menu;
  }
}
