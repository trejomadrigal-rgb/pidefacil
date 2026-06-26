import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PublicService } from './public.service';

@Controller('public/business')
@Public()
export class PublicController {
  constructor(private publicService: PublicService) {}

  @Get(':slug')
  getBusiness(@Param('slug') slug: string) {
    return this.publicService.getBusiness(slug);
  }

  @Get(':slug/branches')
  getBranches(@Param('slug') slug: string) {
    return this.publicService.getBranches(slug);
  }

  @Get(':slug/categories')
  getCategories(
    @Param('slug') slug: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.publicService.getCategories(slug, branchId);
  }

  @Get(':slug/featured-product')
  getFeaturedProduct(@Param('slug') slug: string) {
    return this.publicService.getFeaturedProduct(slug);
  }

  @Get(':slug/products')
  getProducts(
    @Param('slug') slug: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.publicService.getProducts(slug, categoryId, search);
  }

  @Get(':slug/my-orders')
  getOrdersByPhone(
    @Param('slug') slug: string,
    @Query('phone') phone: string,
  ) {
    return this.publicService.getOrdersByPhone(slug, phone ?? '');
  }

  @Get(':slug/payment-methods')
  getPaymentMethods(@Param('slug') slug: string) {
    return this.publicService.getPaymentMethods(slug);
  }

  @Get(':slug/orders/:orderNumber')
  getOrderStatus(
    @Param('slug') slug: string,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.publicService.getOrderStatus(slug, orderNumber);
  }
}
