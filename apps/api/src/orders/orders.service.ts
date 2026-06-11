import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatusDto } from './dto/order-status.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
