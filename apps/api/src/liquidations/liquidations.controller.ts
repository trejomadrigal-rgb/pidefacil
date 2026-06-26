import { Controller, Get, Patch, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ShiftsService } from '../shifts/shifts.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('liquidations')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class LiquidationsController {
  constructor(
    private shifts: ShiftsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.prisma.liquidation.findMany({
      where: { businessId: user.businessId },
      include: {
        shift: { include: { deliveryUser: { select: { name: true } } } },
        confirmedBy: { select: { name: true } },
        orders: { select: { id: true, orderNumber: true, status: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/close')
  closeTrip(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.closeTrip(id, user.businessId, user.userId);
  }
}
