import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('public/orders')
  @Public()
  @UseGuards(RateLimitGuard)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get('public/business/:slug/orders/:orderNumber')
  @Public()
  getStatus(
    @Param('slug') slug: string,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.ordersService.getStatus(slug, orderNumber);
  }
}
