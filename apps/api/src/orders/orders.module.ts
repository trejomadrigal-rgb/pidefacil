import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './orders.admin.controller';
import { OrdersService } from './orders.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController, OrdersAdminController],
  providers: [OrdersService, RateLimitGuard],
})
export class OrdersModule {}
