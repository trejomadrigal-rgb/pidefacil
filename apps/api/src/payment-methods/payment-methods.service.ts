import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.businessPaymentMethod.findMany({
      where: { businessId },
      orderBy: { position: 'asc' },
    });
  }

  async listPublic(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) return [];

    return this.prisma.businessPaymentMethod.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true, label: true, requiresConfirmation: true },
    });
  }

  async create(businessId: string, dto: CreatePaymentMethodDto) {
    const maxPos = await this.prisma.businessPaymentMethod.aggregate({
      where: { businessId },
      _max: { position: true },
    });
    const position = dto.position ?? (maxPos._max.position ?? -1) + 1;

    return this.prisma.businessPaymentMethod.create({
      data: {
        businessId,
        label: dto.label,
        requiresConfirmation: dto.requiresConfirmation ?? false,
        position,
      },
    });
  }

  async update(businessId: string, id: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.prisma.businessPaymentMethod.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Forma de pago no encontrada');

    return this.prisma.businessPaymentMethod.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.requiresConfirmation !== undefined && { requiresConfirmation: dto.requiresConfirmation }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.businessPaymentMethod.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Forma de pago no encontrada');

    const ordersCount = await this.prisma.order.count({ where: { paymentMethodId: id } });
    if (ordersCount > 0) {
      throw new ConflictException(
        'Esta forma de pago tiene pedidos asociados. Desactívala en lugar de eliminarla.',
      );
    }

    await this.prisma.businessPaymentMethod.delete({ where: { id } });
  }
}
