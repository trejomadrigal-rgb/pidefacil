import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@Controller('notifications')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-token')
  async registerToken(
    @Body() dto: RegisterTokenDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.notificationsService.registerToken(user.userId, dto.token, dto.platform);
    return { success: true };
  }

  @Get()
  getNotifications(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.getNotifications(user.businessId);
  }

  // IMPORTANT: 'read-all' must be declared BEFORE ':id/read'
  // NestJS matches routes top-to-bottom; reversing order would make 'read-all' match :id
  @Patch('read-all')
  markAllRead(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.markAllRead(user.businessId);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.notificationsService.markRead(id, user.businessId);
  }
}
