import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WHATSAPP_STATUSES = new Set<OrderStatus>([
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
]);

function buildNewOrderMessage(folio: string, name: string, business: string, statusUrl: string): string {
  return (
    `📩 *Pedido #${folio} recibido*\n\n` +
    `¡Hola ${name}! Recibimos tu pedido en *${business}*.\n` +
    `Pronto te llamaremos para confirmarlo. 📞\n\n` +
    `👉 Ver tu pedido:\n${statusUrl}`
  );
}

function buildConfirmedMessage(
  folio: string,
  name: string,
  business: string,
  items: { name: string; quantity: number; price: number }[],
  total: number,
  paymentMethodLabel: string | null,
  requiresConfirmation: boolean,
  statusUrl: string,
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
    `¡Hola ${name}! Tu pedido en *${business}* fue confirmado.\n\n` +
    `🛒 *Tu pedido:*\n${itemLines}\n\n` +
    `💰 *Total: $${total.toFixed(2)}*${payLine}` +
    transferNote +
    `\n\n👉 Ver estado de tu pedido:\n${statusUrl}`
  );
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, (folio: string, name: string, business: string, statusUrl: string) => string>> = {
  [OrderStatus.OUT_FOR_DELIVERY]: (f, _n, b, u) =>
    `🚗 *Pedido #${f} en camino*\n\nTu pedido de *${b}* ya va en camino. ¡Prepárate!\n\n👉 ${u}`,
  [OrderStatus.DELIVERED]: (f, n, b, _u) =>
    `🎉 *Pedido #${f} entregado*\n\n¡Buen provecho, ${n}! Gracias por pedir en *${b}*.`,
  [OrderStatus.CANCELLED]: (f, _n, b, _u) =>
    `❌ *Pedido #${f} cancelado*\n\nLo sentimos, tu pedido en *${b}* fue cancelado. Disculpa el inconveniente.`,
  [OrderStatus.REJECTED]: (f, _n, b, _u) =>
    `❌ *Pedido #${f} cancelado*\n\nLo sentimos, tu pedido en *${b}* fue cancelado. Disculpa el inconveniente.`,
};

const QR_TTL_MS = 60_000;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly appUrl: string;
  private readonly webUrl: string;

  // Instance name → { qr base64, expiry }. Evolution API v2 delivers QR via webhook.
  private readonly qrStore = new Map<string, { qr: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('EVOLUTION_API_URL') ?? '';
    this.apiKey = this.config.get<string>('EVOLUTION_API_KEY') ?? '';
    this.appUrl = this.config.get<string>('APP_URL') ?? '';
    this.webUrl = this.config.get<string>('WEB_URL') ?? '';
  }

  private headers() {
    return { 'Content-Type': 'application/json', apikey: this.apiKey };
  }

  private async evo<T>(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Evolution API error: ${res.status} ${res.statusText} — ${body}`);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error(`Evolution API timeout: ${this.apiUrl}${path} no respondió en ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Called by the webhook endpoint when Evolution API POSTs a QRCODE_UPDATED event. */
  storeQrFromWebhook(instanceName: string, qr: string): void {
    this.qrStore.set(instanceName, { qr, expiresAt: Date.now() + QR_TTL_MS });
  }

  async connectAndGetQr(businessId: string): Promise<{ status: 'connecting'; qr: string }> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');

    // Remove any existing instance to avoid 409 conflicts on re-connect
    await this.evo('DELETE', `/instance/delete/${biz.slug}`).catch(() => {});
    this.qrStore.delete(biz.slug);

    const payload = { instanceName: biz.slug, qrcode: true };

    const createData = await this.evo<{ qrcode?: { base64?: string } }>('POST', '/instance/create', payload, 30_000);
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
      await this.evo('DELETE', `/instance/delete/${biz.whatsappSession}`).catch(() => {});
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
      select: { name: true, slug: true, whatsappSession: true },
    });

    if (!biz?.whatsappSession) {
      this.logger.warn(`[WA] Pedido #${order.orderNumber}: negocio sin whatsappSession`);
      return;
    }

    const state = await this.getConnectionState(order.businessId);
    if (state !== 'open') {
      this.logger.warn(`[WA] Pedido #${order.orderNumber}: sesión no abierta (estado=${state})`);
      return;
    }

    const digits = order.customerPhone.replace(/\D/g, '');
    const phone = digits.length === 10 ? `52${digits}` : digits;

    const statusUrl = this.webUrl
      ? `${this.webUrl}/${biz.slug}/pedido/${order.orderNumber}`
      : '';

    let text: string;

    if (newStatus === OrderStatus.NEW) {
      text = buildNewOrderMessage(order.orderNumber, order.customerName, biz.name, statusUrl);
    } else if (newStatus === OrderStatus.CONFIRMED) {
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
        statusUrl,
      );
    } else if (newStatus === OrderStatus.READY) {
      const readyOrder = await this.prisma.order.findFirst({
        where: { businessId: order.businessId, orderNumber: order.orderNumber },
        select: { deliveryType: true },
      });
      const isDelivery = readyOrder?.deliveryType === 'DELIVERY';
      text = isDelivery
        ? `📦 *Pedido #${order.orderNumber} listo*\n\nTu pedido de *${biz.name}* está listo y pronto saldrá a entrega. 🛵\n\n👉 Ver tu pedido:\n${statusUrl}`
        : `🛍️ *Pedido #${order.orderNumber} listo para recoger*\n\n¡Tu pedido en *${biz.name}* está listo! Pasa a recogerlo cuando quieras. 🙌\n\n👉 Ver tu pedido:\n${statusUrl}`;
    } else {
      const buildMessage = STATUS_MESSAGES[newStatus];
      if (!buildMessage) return;
      text = buildMessage(order.orderNumber, order.customerName, biz.name, statusUrl);
    }

    try {
      await this.evo('POST', `/message/sendText/${biz.whatsappSession}`, { number: phone, text });
      this.logger.log(`[WA] ✅ Pedido #${order.orderNumber} → ${newStatus} enviado a ${phone}`);
    } catch (err) {
      this.logger.error(`[WA] ❌ Pedido #${order.orderNumber} → ${newStatus} FALLÓ para ${phone}: ${(err as Error)?.message}`);
      throw err;
    }
  }

  async sendTestMessage(businessId: string, phone: string): Promise<{ ok: boolean; error?: string }> {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, whatsappSession: true },
    });

    if (!biz?.whatsappSession) {
      return { ok: false, error: 'WhatsApp no configurado. Conecta primero tu cuenta.' };
    }

    const state = await this.getConnectionState(businessId);
    if (state !== 'open') {
      return { ok: false, error: `Sesión no activa (estado: ${state}). Vuelve a conectar WhatsApp.` };
    }

    const digits = phone.replace(/\D/g, '');
    const normalized = digits.length === 10 ? `52${digits}` : digits;

    try {
      await this.evo('POST', `/message/sendText/${biz.whatsappSession}`, {
        number: normalized,
        text: `✅ *PideFacil — mensaje de prueba*\n\nHola, este es un mensaje de prueba de *${biz.name}*. Si lo recibiste, WhatsApp está funcionando correctamente.`,
      });
      this.logger.log(`[WA] Mensaje de prueba enviado a ${normalized}`);
      return { ok: true };
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Error desconocido';
      this.logger.error(`[WA] Mensaje de prueba FALLÓ para ${normalized}: ${msg}`);
      return { ok: false, error: msg };
    }
  }
}
