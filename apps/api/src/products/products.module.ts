import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [PublicModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
