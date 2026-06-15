import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateLiquidationTripDto } from './dto/create-liquidation-trip.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, openedById: string, dto: CreateShiftDto) {
    const deliveryUser = await this.prisma.user.findFirst({
      where: { id: dto.deliveryUserId, businessId, role: 'DELIVERY' },
    });
    if (!deliveryUser) throw new NotFoundException('Repartidor no encontrado');

    const openShift = await this.prisma.shift.findFirst({
      where: { businessId, deliveryUserId: dto.deliveryUserId, status: 'OPEN' },
    });
    if (openShift) throw new BadRequestException('Este repartidor ya tiene un turno abierto');

    return this.prisma.shift.create({
      data: {
        businessId,
        deliveryUserId: dto.deliveryUserId,
        openedById,
        branchId: dto.branchId,
        notes: dto.notes,
      },
      include: {
        deliveryUser: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        liquidations: true,
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.shift.findMany({
      where: { businessId },
      include: {
        deliveryUser: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        liquidations: {
          include: {
            orders: { select: { id: true, orderNumber: true, status: true, total: true, paymentMethod: true } },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findOne(id: string, businessId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, businessId },
      include: {
        deliveryUser: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        liquidations: {
          include: {
            orders: {
              select: {
                id: true, orderNumber: true, status: true, total: true,
                paymentMethod: true, customerName: true, deliveryAddress: true,
              },
            },
            confirmedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    return shift;
  }

  async close(id: string, businessId: string, closedById: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id, businessId } });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    if (shift.status === 'CLOSED') throw new BadRequestException('El turno ya está cerrado');

    const openTrips = await this.prisma.liquidation.count({
      where: { shiftId: id, status: 'OPEN' },
    });
    if (openTrips > 0) throw new BadRequestException('Hay salidas sin liquidar en este turno');

    return this.prisma.shift.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById },
    });
  }

  async createTrip(shiftId: string, businessId: string, dto: CreateLiquidationTripDto) {
    const shift = await this.prisma.shift.findFirst({ where: { id: shiftId, businessId, status: 'OPEN' } });
    if (!shift) throw new NotFoundException('Turno no encontrado o ya cerrado');

    const orders = await this.prisma.order.findMany({
      where: { id: { in: dto.orderIds }, businessId, status: 'READY' },
    });
    if (orders.length !== dto.orderIds.length) {
      throw new BadRequestException('Algunos pedidos no están en estado READY o no pertenecen al negocio');
    }

    const alreadyAssigned = orders.filter((o) => o.liquidationId !== null);
    if (alreadyAssigned.length > 0) {
      throw new BadRequestException('Algunos pedidos ya están asignados a una salida');
    }

    const transferNotConfirmed = orders.filter(
      (o) => o.paymentMethod === 'TRANSFER' && !o.transferConfirmed,
    );
    if (transferNotConfirmed.length > 0) {
      throw new BadRequestException('Hay pedidos con transferencia pendiente de confirmar');
    }

    return this.prisma.$transaction(async (tx) => {
      const trip = await tx.liquidation.create({
        data: {
          businessId,
          shiftId,
          notes: dto.notes,
        },
      });

      await tx.order.updateMany({
        where: { id: { in: dto.orderIds } },
        data: {
          liquidationId: trip.id,
          assignedToId: shift.deliveryUserId,
        },
      });

      return tx.liquidation.findUnique({
        where: { id: trip.id },
        include: {
          orders: { select: { id: true, orderNumber: true, status: true, total: true, paymentMethod: true, customerName: true } },
        },
      });
    });
  }

  async closeTrip(tripId: string, businessId: string, confirmedById: string) {
    const trip = await this.prisma.liquidation.findFirst({
      where: { id: tripId, businessId },
      include: { orders: true },
    });
    if (!trip) throw new NotFoundException('Salida no encontrada');
    if (trip.status === 'CLOSED') throw new BadRequestException('Esta salida ya está liquidada');

    const cashTotal = trip.orders
      .filter((o) => o.paymentMethod === 'CASH' && o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const cardTotal = trip.orders
      .filter((o) => o.paymentMethod === 'CARD' && o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const transferTotal = trip.orders
      .filter((o) => o.paymentMethod === 'TRANSFER' && o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);

    return this.prisma.liquidation.update({
      where: { id: tripId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        confirmedById,
        cashTotal,
        cardTotal,
        transferTotal,
      },
    });
  }
}
