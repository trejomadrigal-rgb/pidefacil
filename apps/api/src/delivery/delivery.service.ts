import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RtdbService } from '../notifications/rtdb.service';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private rtdb: RtdbService,
  ) {}

  async getMyOrders(userId: string, businessId: string) {
    // Only expose orders from the current active (OPEN) trip.
    // If the repartidor has multiple queued trips, they only see the oldest OPEN one
    // until the admin liquidates it.
    const activeTrip = await this.prisma.liquidation.findFirst({
      where: {
        businessId,
        status: 'OPEN',
        shift: { deliveryUserId: userId, status: 'OPEN' },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: { in: ['READY', 'OUT_FOR_DELIVERY'] } },
          include: {
            items: { include: { product: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      tripId: activeTrip?.id ?? null,
      totalOrdersInTrip: activeTrip?._count?.orders ?? 0,
      orders: activeTrip?.orders ?? [],
    };
  }

  async markOutForDelivery(orderId: string, userId: string, businessId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.assignedToId !== userId) throw new ForbiddenException('No tienes permiso para este pedido');
    if (order.status !== 'READY') {
      throw new ForbiddenException('El pedido debe estar en estado READY para salir a entregar');
    }
    if (order.paymentMethod !== 'CASH' && !order.isPaid) {
      throw new ForbiddenException(
        'El pedido requiere confirmación de pago antes de salir a entrega',
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'OUT_FOR_DELIVERY' },
    });
  }

  async deliver(orderId: string, userId: string, businessId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.assignedToId !== userId) throw new ForbiddenException('No tienes permiso para este pedido');
    if (order.status !== 'OUT_FOR_DELIVERY') {
      throw new ForbiddenException('El pedido debe estar en OUT_FOR_DELIVERY para confirmarlo como entregado');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED', isPaid: true },
    });

    await this.rtdb.deleteChatRoom(orderId);

    return updated;
  }

  async notifyReturn(userId: string, businessId: string) {
    const adminTokens = await this.prisma.deviceToken.findMany({
      where: {
        user: { businessId, role: { in: ['OWNER', 'ADMIN', 'OPERATOR'] } },
      },
      select: { token: true },
    });
    return { notified: adminTokens.length, message: 'Aviso de retorno registrado' };
  }
}
