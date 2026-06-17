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

function buildConfirmedMessage(
  folio: string,
  name: string,
  business: string,
  items: { name: string; quantity: number; price: number }[],
  total: number,
  paymentMethodLabel: string | null,
  requiresConfirmation: boolean,
): string {
  const itemLines = items
    .map((i) => `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`)
    .join('\n');

  const payLine = paymentMethodLabel ? `\n💳 *Pago:* ${paymentMethodLabel}` : '';

  const transferNote = requiresConfirmation
    ? '\n\n⚠️ *Importante:* Tu pedido pasará a preparación una vez que nos envíes el comprobante de pago. Sin comprobante no iniciaremos la preparación.'
    : '\n\nYa lo estamos preparando. 🍳';

  return (
    `✅ *Pedido #${folio} confirmado*\n\n` +
    `¡Hola ${name}! Tu pedido en *${business}* fue recibido.\n\n` +
    `🛒 *Tu pedido:*\n${itemLines}\n\n` +
    `💰 *Total: $${total.toFixed(2)}*${payLine}` +
    transferNote
  );
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, (folio: string, name: string, business: string) => string>> = {
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

const QR_TTL_MS = 60_000;

@Injectable()
export class WhatsappService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly appUrl: string;

  // Instance name → { qr base64, expiry }. Evolution API v2 delivers QR via webhook.
  private readonly qrStore = new Map<string, { qr: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('EVOLUTION_API_URL') ?? '';
    this.apiKey = this.config.get<string>('EVOLUTION_API_KEY') ?? '';
    this.appUrl = this.config.get<string>('APP_URL') ?? '';
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

  /** Called by the webhook endpoint when Evolution API POSTs a QRCODE_UPDATED event. */
  storeQrFromWebhook(instanceName: string, qr: string): void {
    this.qrStore.set(instanceName, { qr, expiresAt: Date.now() + QR_TTL_MS });
  }

  async connectAndGetQr(businessId: string): Promise<{ status: 'connecting'; qr: string }> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');

    // Remove any existing instance to avoid 409 conflicts on re-connect
    await this.evo('DELETE', `/instance/delete/${biz.slug}`, { deleteFiles: false }).catch(() => {});
    this.qrStore.delete(biz.slug);

    const payload: Record<string, unknown> = {
      instanceName: biz.slug,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    };

    // Evolution API v2 delivers QR codes via webhook. Configure it when APP_URL is available.
    if (this.appUrl) {
      payload.webhook = {
        url: `${this.appUrl}/whatsapp/webhook`,
        enabled: true,
        webhookByEvents: false,
        events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE'],
      };
    }

    const createData = await this.evo<{ qrcode?: { base64?: string } }>('POST', '/instance/create', payload);
    await this.prisma.business.update({ where: { id: businessId }, data: { whatsappSession: biz.slug } });

    // Some Evolution API versions return QR directly in the create response
    const immediateQr = createData.qrcode?.base64 ?? '';
    if (immediateQr) return { status: 'connecting', qr: immediateQr };

    // Poll the REST endpoint briefly as fallback (works on some versions)
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      // Check webhook-delivered QR first
      const stored = this.qrStore.get(biz.slug);
      if (stored && stored.expiresAt > Date.now()) {
        return { status: 'connecting', qr: stored.qr };
      }

      try {
        const qrData = await this.evo<{ base64?: string; qrcode?: { base64?: string } }>('GET', `/instance/connect/${biz.slug}`);
        const fetched = qrData.base64 ?? qrData.qrcode?.base64 ?? '';
        if (fetched) return { status: 'connecting', qr: fetched };
      } catch { /* not ready yet */ }
    }

    return { status: 'connecting', qr: '' };
  }

  async getQrByBusinessId(businessId: string): Promise<string | null> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (!biz?.whatsappSession) return null;

    // Check webhook-delivered QR store first (Evolution API v2 primary delivery mechanism)
    const stored = this.qrStore.get(biz.whatsappSession);
    if (stored && stored.expiresAt > Date.now()) return stored.qr;

    // Fallback: REST endpoint (works on some Evolution API versions)
    try {
      const data = await this.evo<{ base64?: string; qrcode?: { base64?: string } }>('GET', `/instance/connect/${biz.whatsappSession}`);
      return data.base64 ?? data.qrcode?.base64 ?? null;
    } catch {
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
      this.qrStore.delete(biz.whatsappSession);
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

    const digits = order.customerPhone.replace(/\D/g, '');
    const phone = digits.length === 10 ? `52${digits}` : digits;

    let text: string;

    if (newStatus === OrderStatus.CONFIRMED) {
      const fullOrder = await this.prisma.order.findFirst({
        where: { businessId: order.businessId, orderNumber: order.orderNumber },
        select: {
          total: true,
          paymentMethodLabel: true,
          customPaymentMethod: { select: { requiresConfirmation: true } },
          items: { select: { quantity: true, price: true, product: { select: { name: true } } } },
        },
      });

      const items = (fullOrder?.items ?? []).map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        price: Number(i.price),
      }));

      text = buildConfirmedMessage(
        order.orderNumber,
        order.customerName,
        biz.name,
        items,
        Number(fullOrder?.total ?? 0),
        fullOrder?.paymentMethodLabel ?? null,
        fullOrder?.customPaymentMethod?.requiresConfirmation ?? false,
      );
    } else {
      const buildMessage = STATUS_MESSAGES[newStatus];
      if (!buildMessage) return;
      text = buildMessage(order.orderNumber, order.customerName, biz.name);
    }

    await this.evo('POST', `/message/sendText/${biz.whatsappSession}`, { number: phone, text });
  }
}
