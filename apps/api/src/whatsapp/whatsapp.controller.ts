import { Controller, Get, Post, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { WhatsappService } from './whatsapp.service';

@Controller('admin/whatsapp')
@Roles(Role.OWNER, Role.ADMIN)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: CurrentUserPayload) {
    const status = await this.whatsappService.getConnectionState(user.businessId);
    return { status };
  }

  @Get('qr')
  async getQr(@CurrentUser() user: CurrentUserPayload) {
    const qr = await this.whatsappService.getQrByBusinessId(user.businessId);
    return { qr };
  }

  @Post('connect')
  @HttpCode(HttpStatus.CREATED)
  async connect(@CurrentUser() user: CurrentUserPayload) {
    return this.whatsappService.connectAndGetQr(user.businessId);
  }

  @Delete('disconnect')
  async disconnect(@CurrentUser() user: CurrentUserPayload) {
    await this.whatsappService.disconnect(user.businessId);
    return { status: 'disconnected' };
  }
}
