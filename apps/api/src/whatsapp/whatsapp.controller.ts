import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
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

  @Post('test')
  async sendTest(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { phone: string },
  ) {
    if (!body?.phone) throw new BadRequestException('Se requiere el número de teléfono');
    return this.whatsappService.sendTestMessage(user.businessId, body.phone);
  }
}

/** Public endpoint — Evolution API v2 POSTs QR code events here. */
@Controller('whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() body: Record<string, unknown>) {
    const event = (body.event as string | undefined) ?? '';
    const instance = (body.instance as string | undefined) ?? '';

    if (!instance) return { ok: true };

    if (event === 'QRCODE_UPDATED' || event === 'qrcode.updated') {
      const data = body.data as Record<string, unknown> | undefined;
      const qrcode = data?.qrcode as Record<string, unknown> | undefined;
      const base64 = (qrcode?.base64 as string | undefined) ?? '';
      if (base64) {
        this.whatsappService.storeQrFromWebhook(instance, base64);
      }
    }

    return { ok: true };
  }
}
