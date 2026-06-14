import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const sub = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    const max = sub?.plan?.maxBranches ?? 1;
    const current = await this.prisma.branch.count({ where: { businessId, status: 'ACTIVE' } });
    if (current >= max) {
      throw new BadRequestException(
        `Tu plan permite máximo ${max} sucursal(es). Actualiza tu plan para agregar más.`,
      );
    }
    return this.prisma.branch.create({ data: { businessId, ...dto } });
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
        status: { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED', 'FINISHED'] },
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException('No se puede eliminar una sucursal con pedidos activos');
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
    await this.prisma.$transaction(
      dto.schedules.map((s) =>
        this.prisma.branchMenuSchedule.upsert({
          where: { branchId_menuId: { branchId, menuId: s.menuId } },
          create: { branchId, menuId: s.menuId, isActive: s.isActive, daysOfWeek: s.daysOfWeek },
          update: { isActive: s.isActive, daysOfWeek: s.daysOfWeek },
        }),
      ),
    );
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
