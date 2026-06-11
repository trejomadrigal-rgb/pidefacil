import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-token')
  async registerToken(
    @Body() dto: RegisterTokenDto,
    @CurrentUser() user: { userId: string },
  ) {
    await this.notificationsService.registerToken(user.userId, dto.token, dto.platform);
    return { success: true };
  }

  @Get()
  getNotifications(@CurrentUser() user: { businessId: string }) {
    return this.notificationsService.getNotifications(user.businessId);
  }

  // IMPORTANT: 'read-all' must be declared BEFORE ':id/read'
  // NestJS matches routes top-to-bottom; reversing order would make 'read-all' match :id
  @Patch('read-all')
  markAllRead(@CurrentUser() user: { businessId: string }) {
    return this.notificationsService.markAllRead(user.businessId);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: { businessId: string },
  ) {
    return this.notificationsService.markRead(id, user.businessId);
  }
}
