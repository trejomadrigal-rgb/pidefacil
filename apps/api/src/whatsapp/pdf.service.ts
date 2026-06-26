import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface TicketData {
  folio: string;
  businessName: string;
  customerName: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  paymentMethodLabel: string | null;
  requiresConfirmation: boolean;
  notes: string | null;
  statusUrl: string;
}

export interface StatusCardData {
  folio: string;
  businessName: string;
  customerName: string;
  headerColor: string;
  statusLabel: string;
  mainMessage: string;
  subMessage?: string;
  statusUrl?: string;
}

const DARK = '#1A1A2E';
const ORANGE = '#FF6B35';
const GRAY = '#888888';
const W = 300;
const M = 20;
const CW = W - M * 2; // 260pt usable width
const HEADER_H = 84;

function drawHeader(doc: PDFKit.PDFDocument, color: string, label: string, folio: string, businessName: string): void {
  doc.rect(0, 0, W, HEADER_H).fill(color);
  doc.fillColor('white').font('Helvetica').fontSize(8)
    .text(label, M, 12, { width: CW, align: 'center' });
  doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(28)
    .text(`#${folio}`, M, 22, { width: CW, align: 'center' });
  doc.fillColor('white').font('Helvetica').fontSize(9)
    .text(businessName, M, 60, { width: CW, align: 'center' });
}

function drawCustomer(doc: PDFKit.PDFDocument, y: number, customerName: string): number {
  doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('CLIENTE', M, y);
  y += 11;
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(customerName, M, y, { width: CW });
  y += 18;
  doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  return y + 12;
}

function drawStatusUrl(doc: PDFKit.PDFDocument, y: number, statusUrl: string): number {
  doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 10;
  doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('VER ESTADO DE TU PEDIDO', M, y);
  y += 11;
  doc.fillColor(ORANGE).font('Helvetica').fontSize(8).text(statusUrl, M, y, { width: CW });
  return y + 22;
}

function drawFooter(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#EEEEEE').lineWidth(0.5).stroke();
  doc.fillColor(GRAY).font('Helvetica').fontSize(7)
    .text('Enviado por PideFacil', M, y + 7, { width: CW, align: 'center' });
}

function makePdf(pageHeight: number, draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [W, pageHeight],
      margins: { top: 0, bottom: 0, left: M, right: M },
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

@Injectable()
export class PdfService {
  // ── Tarjeta de notificación genérica (NEW, READY, EN CAMINO, ENTREGADO, CANCELADO) ──
  generateStatusCard(data: StatusCardData): Promise<Buffer> {
    const mainH = Math.ceil(data.mainMessage.length / 38) * 16 + 10;
    const subH = data.subMessage ? Math.ceil(data.subMessage.length / 38) * 14 + 16 : 0;
    const urlH = data.statusUrl ? 46 : 0;
    const PAGE_H = 190 + mainH + subH + urlH;

    return makePdf(PAGE_H, (doc) => {
      drawHeader(doc, data.headerColor, data.statusLabel, data.folio, data.businessName);
      let y = drawCustomer(doc, HEADER_H + 12, data.customerName);

      // Mensaje principal
      doc.fillColor(DARK).font('Helvetica').fontSize(10)
        .text(data.mainMessage, M, y, { width: CW });
      y += doc.heightOfString(data.mainMessage, { width: CW }) + 10;

      // Submensaje (opcional)
      if (data.subMessage) {
        doc.fillColor('#555555').font('Helvetica-Oblique').fontSize(9)
          .text(data.subMessage, M, y, { width: CW });
        y += doc.heightOfString(data.subMessage, { width: CW }) + 10;
      }

      if (data.statusUrl) {
        y = drawStatusUrl(doc, y + 4, data.statusUrl);
      }

      drawFooter(doc, y);
    });
  }

  // ── Ticket detallado (CONFIRMED) ──────────────────────────────────────────────────
  generateConfirmedTicket(data: TicketData): Promise<Buffer> {
    const itemsH = data.items.length * 20;
    const notesH = data.notes
      ? 14 + Math.ceil(data.notes.length / 40) * 13 + 14
      : 0;
    const paymentH = 40 + (data.requiresConfirmation ? 46 : 0);
    const urlH = data.statusUrl ? 44 : 0;
    const PAGE_H = 220 + itemsH + paymentH + notesH + urlH;

    return makePdf(PAGE_H, (doc) => {
      drawHeader(doc, DARK, 'PEDIDO CONFIRMADO', data.folio, data.businessName);
      let y = drawCustomer(doc, HEADER_H + 12, data.customerName);

      // Items
      doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(7).text('DETALLE DEL PEDIDO', M, y);
      y += 13;

      for (const item of data.items) {
        const lineTotal = `$${(item.price * item.quantity).toFixed(2)}`;
        doc.fillColor('#222222').font('Helvetica').fontSize(9)
          .text(`${item.quantity}x  ${item.name}`, M, y, { width: CW - 55 });
        doc.font('Helvetica-Bold').fontSize(9)
          .text(lineTotal, M + CW - 55, y, { width: 55, align: 'right' });
        y += 20;
      }

      y += 2;
      doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
      y += 8;

      // Total
      doc.rect(M - 4, y - 2, CW + 8, 30).fill(ORANGE);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(14)
        .text(`TOTAL   $${data.total.toFixed(2)}`, M, y + 7, { width: CW, align: 'center' });
      y += 38;

      // Forma de pago
      doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('FORMA DE PAGO', M, y);
      y += 11;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
        .text(data.paymentMethodLabel ?? 'No especificada', M, y, { width: CW });
      y += 16;

      if (data.requiresConfirmation) {
        doc.rect(M - 4, y - 2, CW + 8, 34).fillAndStroke('#FFF3E0', '#FF9800');
        doc.fillColor('#E65100').font('Helvetica').fontSize(8).text(
          'Envia tu comprobante de pago para iniciar la preparacion de tu pedido.',
          M + 2, y + 5, { width: CW - 8 },
        );
        y += 42;
      }

      // Notas
      if (data.notes) {
        doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
        y += 10;
        doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('NOTAS', M, y);
        y += 11;
        doc.fillColor('#555555').font('Helvetica-Oblique').fontSize(9)
          .text(data.notes, M, y, { width: CW });
        y += doc.heightOfString(data.notes, { width: CW }) + 12;
      }

      if (data.statusUrl) {
        y = drawStatusUrl(doc, y, data.statusUrl);
      }

      drawFooter(doc, y);
    });
  }
}
