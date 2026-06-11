// apps/api/src/orders/orders.admin.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { OrdersService } from './orders.service';

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
}
