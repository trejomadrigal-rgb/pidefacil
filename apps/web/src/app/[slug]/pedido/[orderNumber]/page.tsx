import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OrderStatus } from '@/components/order/order-status';

interface Props {
  params: Promise<{ slug: string; orderNumber: string }>;
}

export default async function PedidoPage({ params }: Props) {
  const { slug, orderNumber } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <Link
          href={`/${slug}`}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-bold text-brand-900">Estado del pedido</h1>
      </header>
      <OrderStatus slug={slug} orderNumber={orderNumber} />
    </div>
  );
}
