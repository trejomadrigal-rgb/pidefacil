import { Module } from '@nestjs/common';
import { LiquidationsController } from './liquidations.controller';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [ShiftsModule],
  controllers: [LiquidationsController],
})
export class LiquidationsModule {}
