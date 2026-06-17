'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

function PedidoEnviadoContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const folio = searchParams.get('folio') ?? '';
  const slug = params.slug;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 280, delay: 0.05 }}
          className="text-6xl mb-4"
        >
          🎉
        </motion.div>

        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 340, delay: 0.2 }}
          className="text-4xl font-black text-green-500 mb-2"
        >
          Pedido #{folio}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.35 }}
        >
          <h1 className="text-xl font-bold text-brand-900 mb-2">
            ¡Pedido enviado!
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Te avisaremos por WhatsApp cuando tu pedido sea confirmado.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.48 }}
          className="space-y-3"
        >
          <Link
            href={`/${slug}/pedido/${folio}`}
            className="flex items-center justify-center w-full bg-brand-500 text-white rounded-xl py-3 font-semibold text-sm"
          >
            📋 Ver estado del pedido
          </Link>
          <Link
            href={`/${slug}`}
            className="flex items-center justify-center w-full text-gray-500 py-2 text-sm"
          >
            ← Volver al menú
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

export default function PedidoEnviadoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <PedidoEnviadoContent />
    </Suspense>
  );
}
