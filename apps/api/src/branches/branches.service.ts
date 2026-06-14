import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpsertMenuSchedulesDto } from './dto/upsert-menu-schedules.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, businessId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(businessId: string, dto: CreateBranchDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const sub = await tx.subscription.findUnique({
          where: { businessId },
          include: { plan: true },
        });
        const max = sub?.plan?.maxBranches ?? 1;
        const current = await tx.branch.count({ where: { businessId, status: BranchStatus.ACTIVE } });
        if (current >= max) {
          throw new BadRequestException(
            `Tu plan permite máximo ${max} sucursal(es). Actualiza tu plan para agregar más.`,
          );
        }
        return tx.branch.create({ data: { businessId, ...dto } });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async update(businessId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(businessId, id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    const activeOrders = await this.prisma.order.count({
      where: {
        branchId: id,
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.FINISHED, OrderStatus.OUT_FOR_DELIVERY] },
      },
    });
    if (activeOrders > 0) {
      throw new ForbiddenException('No se puede eliminar una sucursal con pedidos activos');
    }
    await this.prisma.branch.delete({ where: { id } });
  }

  async getMenuSchedules(businessId: string, branchId: string) {
    await this.findOne(businessId, branchId);
    return this.prisma.branchMenuSchedule.findMany({
      where: { branchId },
      include: { menu: { select: { id: true, name: true, type: true } } },
    });
  }

  async upsertMenuSchedules(businessId: string, branchId: string, dto: UpsertMenuSchedulesDto) {
    await this.findOne(businessId, branchId);

    // Validate all menuIds belong to this business (cross-tenant guard)
    const menuIds = dto.schedules.map((s) => s.menuId);
    if (menuIds.length > 0) {
      const ownedCount = await this.prisma.menu.count({
        where: { id: { in: menuIds }, businessId },
      });
      if (ownedCount !== menuIds.length) {
        throw new NotFoundException('Uno o más menús no encontrados');
      }
    }

    // DELETE then INSERT for proper PUT semantics (replaces full schedule set)
    await this.prisma.$transaction([
      this.prisma.branchMenuSchedule.deleteMany({ where: { branchId } }),
      ...dto.schedules.map((s) =>
        this.prisma.branchMenuSchedule.create({
          data: { branchId, menuId: s.menuId, isActive: s.isActive, daysOfWeek: s.daysOfWeek },
        }),
      ),
    ]);
    return this.getMenuSchedules(businessId, branchId);
  }

  async getProductAvailability(businessId: string, branchId: string) {
    await this.findOne(businessId, branchId);
    const products = await this.prisma.product.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        category: { select: { name: true } },
        branchAvailability: { where: { branchId }, select: { isAvailable: true } },
      },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      categoryName: p.category.name,
      defaultAvailable: p.isAvailable,
      branchAvailable:
        p.branchAvailability[0]?.isAvailable ?? p.isAvailable,
      hasOverride: p.branchAvailability.length > 0,
    }));
  }

  async updateProductAvailability(
    businessId: string,
    branchId: string,
    dto: UpdateProductAvailabilityDto,
  ) {
    await this.findOne(businessId, branchId);

    // Validate all productIds belong to this business (cross-tenant guard)
    const productIds = dto.items.map((item) => item.productId);
    if (productIds.length > 0) {
      const ownedCount = await this.prisma.product.count({
        where: { id: { in: productIds }, businessId },
      });
      if (ownedCount !== productIds.length) {
        throw new NotFoundException('Uno o más platillos no encontrados');
      }
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.branchProductAvailability.upsert({
          where: { branchId_productId: { branchId, productId: item.productId } },
          create: { branchId, productId: item.productId, isAvailable: item.isAvailable },
          update: { isAvailable: item.isAvailable },
        }),
      ),
    );
    return this.getProductAvailability(businessId, branchId);
  }
}
