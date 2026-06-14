// apps/api/src/orders/orders.admin.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR, Role.KITCHEN)
export class OrdersAdminController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findActive(@CurrentUser() user: CurrentUserPayload) {
    return this.ordersService.findActive(user.businessId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.businessId);
  }

  @Patch(':id/status')
  @Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user.businessId, dto.status);
  }

  @Patch(':id/confirm-payment')
  @Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
  confirmPayment(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.ordersService.confirmPayment(id, user.businessId);
  }
}
