import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController, WhatsappWebhookController } from './whatsapp.controller';
import { PdfService } from './pdf.service';

@Module({
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [WhatsappService, PdfService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
