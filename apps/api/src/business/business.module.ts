import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [PublicModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
