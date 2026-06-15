import { Module } from '@nestjs/common';
import { ShiftsAdminController } from './shifts.admin.controller';
import { ShiftsService } from './shifts.service';

@Module({
  controllers: [ShiftsAdminController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
