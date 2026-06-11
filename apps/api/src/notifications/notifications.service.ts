import { Injectable, NotFoundException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly fcm: FcmService,
  ) {}

  async notifyNewOrder(
    businessId: string,
    order: { id: string; orderNumber: string; customerName: string; total: number },
  ): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        businessId,
        type: 'NEW_PREORDER',
        title: `Nuevo pedido #${order.orderNumber}`,
        message: `${order.customerName} · $${order.total}`,
      },
    });

    this.gateway.emitToRoom(businessId, 'new_order', {
      notificationId: notification.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: order.total,
      createdAt: notification.createdAt.toISOString(),
    });

    const tokens = await this.prisma.deviceToken.findMany({
      where: { user: { businessId } },
      select: { token: true },
    });
    await this.fcm.sendToTokens(tokens.map((t) => t.token), {
      title: `Nuevo pedido #${order.orderNumber}`,
      body: `${order.customerName} · $${order.total}`,
    });
  }

  async getNotifications(businessId: string) {
    const data = await this.prisma.notification.findMany({
      where: { businessId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 20,
      select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true },
    });
    return { data, unreadCount: data.filter((n) => !n.isRead).length };
  }

  async markRead(id: string, businessId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, businessId } });
    if (!notification) throw new NotFoundException('Notificación no encontrada');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(businessId: string) {
    return this.prisma.notification.updateMany({
      where: { businessId, isRead: false },
      data: { isRead: true },
    });
  }

  async registerToken(userId: string, token: string, platform: Platform): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }
}
