import { Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
@Roles(Role.DELIVERY)
export class DeliveryController {
  constructor(private delivery: DeliveryService) {}

  @Get('orders')
  getMyOrders(@CurrentUser() user: CurrentUserPayload) {
    return this.delivery.getMyOrders(user.userId, user.businessId);
  }

  @Patch('orders/:id/out-for-delivery')
  outForDelivery(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.delivery.markOutForDelivery(id, user.userId, user.businessId);
  }

  @Patch('orders/:id/deliver')
  deliver(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.delivery.deliver(id, user.userId, user.businessId);
  }

  @Post('notify-return')
  notifyReturn(@CurrentUser() user: CurrentUserPayload) {
    return this.delivery.notifyReturn(user.userId, user.businessId);
  }
}
