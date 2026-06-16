import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
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
}

/** Public endpoint — Evolution API v2 POSTs QR code events here. */
@Controller('whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger('WhatsappWebhook');

  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() body: Record<string, unknown>) {
    const event = (body.event as string | undefined) ?? '';
    const instance = (body.instance as string | undefined) ?? '';

    this.logger.log(`[WH] event=${event} instance=${instance}`);

    if (!instance) return { ok: true };

    // Handle QRCODE_UPDATED event (Evolution API v2 delivers QR via webhook)
    if (event === 'QRCODE_UPDATED' || event === 'qrcode.updated') {
      const data = body.data as Record<string, unknown> | undefined;
      const qrcode = data?.qrcode as Record<string, unknown> | undefined;
      const base64 = (qrcode?.base64 as string | undefined) ?? '';
      this.logger.log(`[WH] QR received for ${instance}, base64 length=${base64.length}`);
      if (base64) {
        this.whatsappService.storeQrFromWebhook(instance, base64);
      }
    }

    return { ok: true };
  }
}
