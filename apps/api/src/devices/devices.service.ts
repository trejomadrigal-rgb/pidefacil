import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async register(businessId: string, userId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findUnique({ where: { token: dto.token } });
    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new ForbiddenException('DEVICE_BLOCKED');
      }
      await this.prisma.device.update({
        where: { token: dto.token },
        data: { userId, lastSeenAt: new Date() },
      });
      return { status: existing.status, deviceId: existing.id };
    }
    const device = await this.prisma.device.create({
      data: { businessId, userId, name: dto.name, deviceType: dto.deviceType, token: dto.token },
    });
    return { status: device.status, deviceId: device.id };
  }

  async findAll(businessId: string) {
    return this.prisma.device.findMany({
      where: { businessId },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(businessId: string, id: string, branchId?: string) {
    const device = await this.prisma.device.findFirst({ where: { id, businessId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');

    // Validate branchId belongs to business if provided
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, businessId } });
      if (!branch) throw new NotFoundException('Sucursal no encontrada');
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    const max = sub?.plan?.maxDevices ?? 4;
    const active = await this.prisma.device.count({ where: { businessId, status: 'ACTIVE' } });
    if (active >= max) {
      throw new BadRequestException(
        `Tu plan permite máximo ${max} dispositivo(s) activo(s). Actualiza tu plan para agregar más.`,
      );
    }

    return this.prisma.device.update({
      where: { id },
      data: { status: 'ACTIVE', branchId: branchId ?? null },
    });
  }

  async block(businessId: string, id: string) {
    const device = await this.prisma.device.findFirst({ where: { id, businessId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return this.prisma.device.update({ where: { id }, data: { status: 'BLOCKED' } });
  }

  async remove(businessId: string, id: string) {
    const device = await this.prisma.device.findFirst({ where: { id, businessId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    await this.prisma.device.delete({ where: { id } });
  }

  async checkToken(token: string): Promise<'PENDING' | 'ACTIVE' | 'BLOCKED' | null> {
    const device = await this.prisma.device.findUnique({
      where: { token },
      select: { status: true },
    });
    return (device?.status as 'PENDING' | 'ACTIVE' | 'BLOCKED') ?? null;
  }
}
