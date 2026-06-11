import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatusDto } from './dto/order-status.dto';
import { OrderListItemDto } from './dto/order-list-item.dto';
import { OrderDetailDto } from './dto/order-detail.dto';

// Used by updateStatus() — defined here so it's available when Task 4 adds that method
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW:                  [OrderStatus.UNDER_REVIEW, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  UNDER_REVIEW:         [OrderStatus.CONFIRMED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  CONFIRMED:            [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
  IN_PREPARATION:       [OrderStatus.READY],
  READY:                [OrderStatus.DELIVERED],
  DELIVERED:            [],
  FINISHED:             [],
  REJECTED:             [],
  CANCELLED:            [],
  // TODO: WAITING_CONFIRMATION is a dead state — no inbound transitions exist yet.
  // Define transitions or remove from enum once business rules are validated post-pilot.
  WAITING_CONFIRMATION: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findActive(businessId: string): Promise<OrderListItemDto[]> {
    // UTC midnight — aceptable para MVP. Pedidos 00:00-06:00 hora México
    // aparecen en el "día siguiente" UTC. Corregir post-piloto con timezone.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: startOfDay },
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.FINISHED, OrderStatus.WAITING_CONFIRMATION] },
      },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryType: o.deliveryType,
      total: Number(o.total),
      itemCount: o._count.items,
      createdAt: o.createdAt,
    }));
  }

  async findOne(id: string, businessId: string): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: { select: { id: true, name: true, phone: true, notes: true, trustLevel: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryType: order.deliveryType,
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        price: Number(i.price),
        subtotal: Number(i.subtotal),
        notes: i.notes,
      })),
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            phone: order.customer.phone,
            notes: order.customer.notes,
            trustLevel: order.customer.trustLevel,
          }
        : null,
    };
  }

  async updateStatus(id: string, businessId: string, newStatus: OrderStatus): Promise<OrderDetailDto> {
    // Non-atomic check-then-update: two concurrent requests could both pass the transition
    // check and both write. Acceptable for MVP; fix with optimistic locking post-pilot.
    const order = await this.prisma.order.findFirst({ where: { id, businessId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transición inválida: no se puede mover de ${order.status} a ${newStatus}`,
      );
    }

    await this.prisma.order.update({ where: { id, businessId }, data: { status: newStatus } });

    // Increment totalOrders and auto-upgrade trust level when order is delivered
    if (
      (newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.FINISHED) &&
      order.customerId
    ) {
      // Increment is atomic; concurrent DELIVERED writes both increment safely.
      // Both then write the same trustLevel (idempotent) — acceptable for MVP.
      const updated = await this.prisma.customer.update({
        where: { id: order.customerId },
        data: { totalOrders: { increment: 1 } },
      });
      if (updated.trustLevel !== 'RISK' && updated.trustLevel !== 'BLOCKED') {
        const newLevel =
          updated.totalOrders >= 10
            ? 'TRUSTED'
            : updated.totalOrders >= 3
              ? 'FREQUENT'
              : updated.trustLevel;
        if (newLevel !== updated.trustLevel) {
          await this.prisma.customer.update({
            where: { id: updated.id },
            data: { trustLevel: newLevel },
          });
        }
      }
    }

    return this.findOne(id, businessId);
  }

  async create(dto: CreateOrderDto) {
    const business = await this.prisma.business.findUnique({
      where: { id: dto.businessId },
    });
    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }
    if (business.status !== 'ACTIVE') {
      throw new BadRequestException('Este negocio no está aceptando pedidos');
    }
    if (dto.deliveryType === 'DELIVERY' && !dto.address?.street) {
      throw new BadRequestException(
        'Se requiere dirección para pedidos con entrega a domicilio',
      );
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El pedido debe tener al menos un producto');
    }

    // Validate each item and calculate prices
    const resolvedItems: Array<{
      productId: string;
      quantity: number;
      notes?: string;
      price: number;
      subtotal: number;
    }> = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          category: { menu: { businessId: dto.businessId } },
        },
        include: {
          variants: true,
          extras: true,
        },
      });
      if (!product) {
        throw new BadRequestException(
          `Producto ${item.productId} no pertenece a este negocio`,
        );
      }
      if (!product.isAvailable) {
        throw new BadRequestException(
          `El producto "${product.name}" no está disponible`,
        );
      }

      let price = Number(product.price);

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new BadRequestException(
            `Variante ${item.variantId} no pertenece al producto "${product.name}"`,
          );
        }
        price += Number(variant.price ?? 0);
      }

      const extraIds = item.extraIds ?? [];
      for (const extraId of extraIds) {
        const extra = product.extras.find((e) => e.id === extraId);
        if (!extra) {
          throw new BadRequestException(
            `Extra ${extraId} no pertenece al producto "${product.name}"`,
          );
        }
        price += Number(extra.price);
      }

      resolvedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        price,
        subtotal: price * item.quantity,
      });
    }

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.subtotal, 0);
    const total = subtotal; // No delivery fee or discount at order creation time

    // Generate orderNumber inside transaction (SERIALIZABLE to prevent duplicate orderNumber on concurrent inserts)
    const order = await this.prisma
      .$transaction(
        async (tx) => {
          const result = await tx.$queryRaw<{ max: string | null }[]>(
            Prisma.sql`SELECT MAX(CAST("orderNumber" AS INTEGER)) as max FROM "Order" WHERE "businessId" = ${dto.businessId}`,
          );
          const maxNum = result[0]?.max ? parseInt(result[0].max, 10) : 0;
          const orderNumber = String(maxNum + 1);

          const deliveryAddress =
            dto.deliveryType === 'DELIVERY' && dto.address
              ? `${dto.address.street}${dto.address.references ? ' - ' + dto.address.references : ''}`
              : null;

          return tx.order.create({
            data: {
              orderNumber,
              businessId: dto.businessId,
              status: 'NEW',
              subtotal,
              total,
              notes: dto.notes,
              deliveryType: dto.deliveryType,
              customerName: dto.customer.name,
              customerPhone: dto.customer.phone,
              deliveryAddress,
              items: {
                create: resolvedItems.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  price: item.price,
                  subtotal: item.subtotal,
                  notes: item.notes,
                })),
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((err) => {
        if (err?.code === 'P2002') {
          throw new BadRequestException(
            'Error al generar el número de pedido, intenta de nuevo',
          );
        }
        throw err;
      });

    // Upsert customer by (businessId, phone) and link to this order
    const customer = await this.prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: dto.businessId,
          phone: dto.customer.phone,
        },
      },
      create: {
        businessId: dto.businessId,
        name: dto.customer.name,
        phone: dto.customer.phone,
        notes: dto.deliveryNotes,
      },
      update: {
        name: dto.customer.name,
        ...(dto.deliveryNotes !== undefined ? { notes: dto.deliveryNotes } : {}),
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { customerId: customer.id },
    });

    await this.notificationsService.notifyNewOrder(dto.businessId, {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: dto.customer.name,
      total: Number(order.total),
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    };
  }

  async getStatus(slug: string, orderNumber: string): Promise<OrderStatusDto> {
    const business = await this.prisma.business.findUnique({
      where: { slug },
    });
    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const order = await this.prisma.order.findFirst({
      where: { businessId: business.id, orderNumber },
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      deliveryType: order.deliveryType,
      items: order.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        subtotal: Number(i.subtotal),
      })),
      createdAt: order.createdAt,
    };
  }
}
