import { Module } from '@nestjs/common';
import { ShiftsAdminController } from './shifts.admin.controller';
import { ShiftsService } from './shifts.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ShiftsAdminController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
