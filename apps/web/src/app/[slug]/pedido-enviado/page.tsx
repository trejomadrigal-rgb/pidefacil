'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatPhone } from '@/lib/utils';

export default function PedidoEnviadoPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const folio = searchParams.get('folio') ?? '';
  const phone = searchParams.get('phone') ?? '';
  const slug = params.slug;

  const whatsappText = encodeURIComponent(
    `Hola, mi pedido es el #${folio}`,
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4">🎉</div>
        <div className="text-4xl font-black text-green-500 mb-2">#{folio}</div>
        <h1 className="text-xl font-bold text-brand-900 mb-2">
          ¡Pedido enviado!
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          El negocio revisará tu pedido y te contactará al{' '}
          <span className="font-semibold text-brand-900">
            {formatPhone(phone)}
          </span>
        </p>

        <div className="space-y-3">
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500 text-white rounded-2xl py-4 font-bold"
          >
            💬 Enviar por WhatsApp
          </a>
          <Link
            href={`/${slug}/pedido/${folio}`}
            className="flex items-center justify-center w-full border-2 border-brand-500 text-brand-500 rounded-2xl py-4 font-bold"
          >
            📋 Ver estado del pedido
          </Link>
          <Link
            href={`/${slug}`}
            className="flex items-center justify-center w-full text-gray-500 py-3 text-sm"
          >
            ← Volver al menú
          </Link>
        </div>
      </div>
    </div>
  );
}
