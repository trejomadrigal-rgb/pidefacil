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

const DARK = '#1A1A2E';
const ORANGE = '#FF6B35';
const GRAY = '#888888';

@Injectable()
export class PdfService {
  async generateConfirmedTicket(data: TicketData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const W = 300;
      const M = 20;
      const CW = W - M * 2; // 260pt content width

      // Pre-calculate page height
      const itemsH = data.items.length * 20;
      const notesH = data.notes
        ? 14 + Math.ceil(data.notes.length / 40) * 13 + 14
        : 0;
      const paymentH = 40 + (data.requiresConfirmation ? 46 : 0);
      const urlH = data.statusUrl ? 44 : 0;
      const PAGE_H = 220 + itemsH + paymentH + notesH + urlH;

      const doc = new PDFDocument({
        size: [W, PAGE_H],
        margins: { top: 0, bottom: 0, left: M, right: M },
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = 0;

      // ── HEADER ────────────────────────────────────────
      const HEADER_H = 84;
      doc.rect(0, 0, W, HEADER_H).fill(DARK);

      doc.fillColor('white').font('Helvetica').fontSize(8)
        .text('PEDIDO CONFIRMADO', M, 12, { width: CW, align: 'center' });

      doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(28)
        .text(`#${data.folio}`, M, 22, { width: CW, align: 'center' });

      doc.fillColor('white').font('Helvetica').fontSize(9)
        .text(data.businessName, M, 60, { width: CW, align: 'center' });

      y = HEADER_H + 12;

      // ── CLIENTE ───────────────────────────────────────
      doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('CLIENTE', M, y);
      y += 11;
      doc.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(10)
        .text(data.customerName, M, y, { width: CW });
      y += 18;

      // ── DIVIDER ───────────────────────────────────────
      doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
      y += 12;

      // ── ITEMS ─────────────────────────────────────────
      doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(7)
        .text('DETALLE DEL PEDIDO', M, y);
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

      // ── TOTAL ─────────────────────────────────────────
      doc.rect(M - 4, y - 2, CW + 8, 30).fill(ORANGE);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(14)
        .text(`TOTAL   $${data.total.toFixed(2)}`, M, y + 7, {
          width: CW,
          align: 'center',
        });
      y += 38;

      // ── FORMA DE PAGO ────────────────────────────────
      doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('FORMA DE PAGO', M, y);
      y += 11;
      doc.fillColor('#1A1A2E').font('Helvetica-Bold').fontSize(10)
        .text(data.paymentMethodLabel ?? 'No especificada', M, y, { width: CW });
      y += 16;

      if (data.requiresConfirmation) {
        // Warning box
        doc.rect(M - 4, y - 2, CW + 8, 34).fillAndStroke('#FFF3E0', '#FF9800');
        doc.fillColor('#E65100').font('Helvetica').fontSize(8).text(
          'Envía tu comprobante de pago para iniciar la preparación de tu pedido.',
          M + 2,
          y + 5,
          { width: CW - 8 },
        );
        y += 42;
      }

      // ── NOTAS ─────────────────────────────────────────
      if (data.notes) {
        doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
        y += 10;
        doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('NOTAS', M, y);
        y += 11;
        doc.fillColor('#555555').font('Helvetica-Oblique').fontSize(9)
          .text(data.notes, M, y, { width: CW });
        y += doc.heightOfString(data.notes, { width: CW }) + 12;
      }

      // ── STATUS URL ────────────────────────────────────
      if (data.statusUrl) {
        doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
        y += 10;
        doc.fillColor(GRAY).font('Helvetica').fontSize(7).text('VER ESTADO DE TU PEDIDO', M, y);
        y += 11;
        doc.fillColor(ORANGE).font('Helvetica').fontSize(8)
          .text(data.statusUrl, M, y, { width: CW });
        y += 22;
      }

      // ── FOOTER ────────────────────────────────────────
      doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#EEEEEE').lineWidth(0.5).stroke();
      y += 7;
      doc.fillColor(GRAY).font('Helvetica').fontSize(7)
        .text('Enviado por PideFacil', M, y, { width: CW, align: 'center' });

      doc.end();
    });
  }
}
