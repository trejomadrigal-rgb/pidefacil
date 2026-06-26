'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { getBusiness, getPaymentMethods, type BusinessPublic, type PublicPaymentMethod } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { items } = useCartStore();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted && items.length === 0) {
      router.replace(`/${slug}`);
    }
  }, [submitted, items.length, slug, router]);

  if (!submitted && items.length === 0) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-brand-900">Confirmar pedido</h1>
      </header>
      <div className="px-4 pt-4">
        <CheckoutFormWrapper slug={slug} onSubmitted={() => setSubmitted(true)} />
      </div>
    </div>
  );
}

function CheckoutFormWrapper({ slug, onSubmitted }: { slug: string; onSubmitted: () => void }) {
  const [business, setBusiness] = useState<BusinessPublic | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);

  useEffect(() => {
    Promise.all([getBusiness(slug), getPaymentMethods(slug)])
      .then(([b, pm]) => {
        setBusiness(b);
        setPaymentMethods(pm);
      })
      .catch(() => {});
  }, [slug]);

  if (!business) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <CheckoutForm slug={slug} businessId={business.id} businessPhone={business.phone} paymentMethods={paymentMethods} onSubmitted={onSubmitted} />;
}
