import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, RateLimitGuard],
})
export class OrdersModule {}
