import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLiquidationDto } from './dto/create-liquidation.dto';

@Injectable()
export class LiquidationsService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, deliveryUserId: string, dto: CreateLiquidationDto) {
    // Validate branchId belongs to business
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    // Validate receivedById belongs to business
    const receiver = await this.prisma.user.findFirst({
      where: { id: dto.receivedById, businessId },
    });
    if (!receiver) throw new NotFoundException('Usuario receptor no encontrado');

    return this.prisma.liquidation.create({
      data: {
        businessId,
        branchId: dto.branchId,
        deliveryUserId,
        receivedById: dto.receivedById,
        amount: dto.amount,
        notes: dto.notes,
      },
      include: {
        branch: { select: { name: true } },
        deliveryUser: { select: { name: true } },
        receivedBy: { select: { name: true } },
      },
    });
  }

  async findAll(businessId: string, branchId?: string) {
    return this.prisma.liquidation.findMany({
      where: { businessId, ...(branchId && { branchId }) },
      include: {
        branch: { select: { name: true } },
        deliveryUser: { select: { name: true } },
        receivedBy: { select: { name: true } },
      },
      orderBy: { settledAt: 'desc' },
    });
  }
}
