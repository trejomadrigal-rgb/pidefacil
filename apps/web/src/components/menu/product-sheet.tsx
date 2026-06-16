'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { Product, ProductExtra, ProductVariant } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart.store';

interface ProductSheetProps {
  product: Product;
  slug: string;
  open: boolean;
  onClose: () => void;
}

export function ProductSheet({
  product,
  slug,
  open,
  onClose,
}: ProductSheetProps) {
  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariant | null>(
      product.variants.length > 0 ? product.variants[0] : null,
    );
  const [selectedExtras, setSelectedExtras] = useState<ProductExtra[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [activeHints, setActiveHints] = useState<string[]>([]);
  const { addItem } = useCartStore();

  const toggleHint = (hint: string) => {
    setActiveHints((prev) =>
      prev.includes(hint) ? prev.filter((h) => h !== hint) : [...prev, hint],
    );
  };

  const toggleExtra = (extra: ProductExtra) => {
    setSelectedExtras((prev) =>
      prev.some((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra],
    );
  };

  const unitPrice =
    product.price +
    (selectedVariant?.price ?? 0) +
    selectedExtras.reduce((sum, e) => sum + e.price, 0);

  const handleAdd = () => {
    if (product.variants.length > 0 && !selectedVariant) return;

    const hintText = activeHints.join(', ');
    const fullNotes = [hintText, notes.trim()].filter(Boolean).join('. ');

    addItem(slug, {
      productId: product.id,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      name: product.name,
      imageUrl: product.imageUrl,
      price: unitPrice,
      extras: selectedExtras,
      notes: fullNotes || undefined,
      quantity,
    });
    setActiveHints([]);
    setNotes('');
    setQuantity(1);
    setSelectedExtras([]);
    setSelectedVariant(product.variants.length > 0 ? product.variants[0] : null);
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <Dialog.Content asChild>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 380 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto focus:outline-none"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Close button */}
          <Dialog.Close className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <X size={16} />
          </Dialog.Close>

          <div className="px-4 pb-6">
            {/* Image */}
            {product.imageUrl ? (
              <div className="relative w-full h-40 rounded-xl overflow-hidden mb-4">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-32 rounded-xl bg-brand-50 flex items-center justify-center text-5xl mb-4">
                🍽️
              </div>
            )}

            {/* Name + price */}
            <h2 className="text-lg font-bold text-brand-900">{product.name}</h2>
            <p className="text-brand-500 font-semibold mt-0.5">
              {formatPrice(product.price)}
            </p>
            {product.description && (
              <p className="text-sm text-gray-500 mt-2">{product.description}</p>
            )}

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Tamaño <span className="text-brand-500">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        selectedVariant?.id === variant.id
                          ? 'border-brand-500 text-brand-500 bg-brand-50'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {variant.name}
                      {variant.price > 0 && ` +${formatPrice(variant.price)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Extras */}
            {product.extras.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Extras
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.extras.map((extra) => {
                    const isSelected = selectedExtras.some((e) => e.id === extra.id);
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        onClick={() => toggleExtra(extra)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          isSelected
                            ? 'border-green-500 text-green-600 bg-green-50'
                            : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {isSelected && '✓ '}{extra.name}
                        {extra.price > 0 && ` +${formatPrice(extra.price)}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Note hints */}
            {product.noteHints.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                  Personalizar
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.noteHints.map((hint) => {
                    const isActive = activeHints.includes(hint);
                    return (
                      <button
                        key={hint}
                        type="button"
                        onClick={() => toggleHint(hint)}
                        className="px-3 py-1 rounded-full text-xs font-bold transition-colors border-2"
                        style={
                          isActive
                            ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: '#FFF3EE' }
                            : { borderColor: '#E5E7EB', color: '#6B7280', background: '#F9FAFB' }
                        }
                      >
                        {isActive ? `✓ ${hint}` : hint}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas (opcional): sin cebolla, extra salsa..."
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Quantity + Add button */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-3 bg-brand-50 rounded-xl px-3 py-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-brand-500 font-bold text-lg w-6 h-6 flex items-center justify-center"
                >
                  <Minus size={16} />
                </button>
                <span className="font-bold text-brand-900 w-6 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="text-brand-500 font-bold text-lg w-6 h-6 flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={product.variants.length > 0 && !selectedVariant}
                className="flex-1 bg-brand-500 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50"
              >
                Agregar · {formatPrice(unitPrice * quantity)}
              </button>
            </div>
          </div>
        </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
