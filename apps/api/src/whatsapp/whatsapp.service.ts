import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WHATSAPP_STATUSES = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
]);

const STATUS_MESSAGES: Partial<Record<OrderStatus, (folio: string, name: string, business: string) => string>> = {
  [OrderStatus.CONFIRMED]: (f, n, b) =>
    `✅ *Pedido #${f} confirmado*\n\n¡Hola ${n}! Tu pedido en *${b}* fue aceptado. Ya lo estamos preparando. 🍳`,
  [OrderStatus.READY]: (f, _n, b) =>
    `🍽️ *Pedido #${f} listo*\n\n¡Tu pedido en *${b}* está listo para recoger!`,
  [OrderStatus.OUT_FOR_DELIVERY]: (f, _n, b) =>
    `🚗 *Pedido #${f} en camino*\n\nTu pedido de *${b}* ya va en camino. ¡Prepárate!`,
  [OrderStatus.DELIVERED]: (f, n, b) =>
    `🎉 *Pedido #${f} entregado*\n\n¡Buen provecho, ${n}! Gracias por pedir en *${b}*.`,
  [OrderStatus.CANCELLED]: (f, _n, b) =>
    `❌ *Pedido #${f} cancelado*\n\nLo sentimos, tu pedido en *${b}* fue cancelado. Disculpa el inconveniente.`,
  [OrderStatus.REJECTED]: (f, _n, b) =>
    `❌ *Pedido #${f} cancelado*\n\nLo sentimos, tu pedido en *${b}* fue cancelado. Disculpa el inconveniente.`,
};

@Injectable()
export class WhatsappService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('EVOLUTION_API_URL') ?? '';
    this.apiKey = this.config.get<string>('EVOLUTION_API_KEY') ?? '';
  }

  private headers() {
    return { 'Content-Type': 'application/json', apikey: this.apiKey };
  }

  private async evo<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Evolution API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async connectAndGetQr(businessId: string): Promise<{ status: 'connecting'; qr: string }> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');

    // Remove any existing instance to avoid 409 conflicts on re-connect
    await this.evo('DELETE', `/instance/delete/${biz.slug}`, { deleteFiles: false }).catch(() => {});

    const createData = await this.evo<Record<string, unknown>>('POST', '/instance/create', {
      instanceName: biz.slug,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
    console.log('[WA] POST /instance/create raw:', JSON.stringify(createData).slice(0, 500));
    await this.prisma.business.update({ where: { id: businessId }, data: { whatsappSession: biz.slug } });

    // Evolution API v2 returns QR directly in the create response
    const cd = createData as { qrcode?: { base64?: string } };
    const qr = cd.qrcode?.base64 ?? '';
    if (qr) {
      console.log('[WA] QR found in create response');
      return { status: 'connecting', qr };
    }

    // Fallback: poll for QR (WA connection + QR generation takes a few seconds)
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const qrData = await this.evo<Record<string, unknown>>('GET', `/instance/connect/${biz.slug}`);
        console.log(`[WA] GET /instance/connect retry ${i + 1} raw:`, JSON.stringify(qrData).slice(0, 500));
        const qd = qrData as { base64?: string; qrcode?: { base64?: string } };
        const fetched = qd.base64 ?? qd.qrcode?.base64 ?? '';
        if (fetched) return { status: 'connecting', qr: fetched };
      } catch (err) {
        console.log(`[WA] GET /instance/connect retry ${i + 1} error:`, String(err));
      }
    }
    console.log('[WA] QR not found after retries — returning empty');
    return { status: 'connecting', qr: '' };
  }

  async getQrByBusinessId(businessId: string): Promise<string | null> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (!biz?.whatsappSession) return null;
    try {
      const data = await this.evo<Record<string, unknown>>('GET', `/instance/connect/${biz.whatsappSession}`);
      console.log('[WA] getQr raw:', JSON.stringify(data).slice(0, 300));
      const d = data as { base64?: string; qrcode?: { base64?: string } };
      return d.base64 ?? d.qrcode?.base64 ?? null;
    } catch (err) {
      console.log('[WA] getQr error:', String(err));
      return null;
    }
  }

  async getConnectionState(businessId: string): Promise<'open' | 'connecting' | 'close' | 'not_configured'> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (!biz?.whatsappSession) return 'not_configured';
    try {
      const data = await this.evo<{ instance?: { state?: string } }>('GET', `/instance/connectionState/${biz.whatsappSession}`);
      const state = data.instance?.state;
      if (state === 'open') return 'open';
      if (state === 'connecting') return 'connecting';
      return 'close';
    } catch {
      return 'close';
    }
  }

  async disconnect(businessId: string): Promise<void> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (biz?.whatsappSession) {
      await this.evo('DELETE', `/instance/delete/${biz.whatsappSession}`, { deleteFiles: false }).catch(() => {});
      await this.prisma.business.update({ where: { id: businessId }, data: { whatsappSession: null } });
    }
  }

  async sendStatusMessage(
    order: { businessId: string; orderNumber: string; customerName: string; customerPhone: string },
    newStatus: OrderStatus,
  ): Promise<void> {
    if (!WHATSAPP_STATUSES.has(newStatus)) return;

    const biz = await this.prisma.business.findUnique({
      where: { id: order.businessId },
      select: { name: true, whatsappSession: true },
    });
    if (!biz?.whatsappSession) return;

    const state = await this.getConnectionState(order.businessId);
    if (state !== 'open') return;

    const buildMessage = STATUS_MESSAGES[newStatus];
    if (!buildMessage) return;

    const digits = order.customerPhone.replace(/\D/g, '');
    const phone = digits.length === 10 ? `52${digits}` : digits;
    const text = buildMessage(order.orderNumber, order.customerName, biz.name);

    await this.evo('POST', `/message/sendText/${biz.whatsappSession}`, { number: phone, text });
  }
}
