'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomer, useUpdateCustomer, type TrustLevel } from '@/hooks/use-customers';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TRUST_LABELS: Record<TrustLevel, string> = {
  NEW: 'Nuevo',
  FREQUENT: 'Frecuente',
  TRUSTED: 'Confiable',
  RISK: 'Riesgo',
  BLOCKED: 'Bloqueado',
};

const TRUST_CLASSES: Record<TrustLevel, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  FREQUENT: 'bg-blue-100 text-blue-700',
  TRUSTED: 'bg-green-100 text-green-700',
  RISK: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading, isError } = useCustomer(params.id);
  const { mutate: updateCustomer, isPending } = useUpdateCustomer(params.id);

  const [notes, setNotes] = useState('');
  const [notesInit, setNotesInit] = useState(false);

  useEffect(() => {
    if (customer && !notesInit) {
      setNotes(customer.notes ?? '');
      setNotesInit(true);
    }
  }, [customer, notesInit]);

  if (isLoading) return <div className="p-8 text-gray-500">Cargando...</div>;
  if (isError || !customer) return <div className="p-8 text-red-500">Cliente no encontrado.</div>;

  return (
    <div className="p-8 max-w-2xl h-full overflow-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4 hover:text-gray-600">
        ← Volver
      </button>

      <h1 className="font-jakarta text-2xl font-bold text-brand-900 mb-1">{customer.name}</h1>
      <p className="text-gray-500 text-sm mb-6">{customer.phone}</p>

      <div className="space-y-4">
        {/* Trust level */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
            Nivel de confianza
          </label>
          <Select
            key={customer.id}
            defaultValue={customer.trustLevel}
            onValueChange={(val) => updateCustomer({ trustLevel: val as TrustLevel })}
            disabled={isPending}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TRUST_LABELS) as TrustLevel[]).map((level) => (
                <SelectItem key={level} value={level}>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TRUST_CLASSES[level]}`}>
                    {TRUST_LABELS[level]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Estadísticas</p>
          <p className="text-gray-900 font-semibold">{customer.totalOrders} pedidos completados</p>
          <p className="text-gray-400 text-xs mt-1">
            Cliente desde {new Date(customer.createdAt).toLocaleDateString('es-MX')}
          </p>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
            Indicaciones de entrega
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (customer.notes ?? '')) updateCustomer({ notes });
            }}
            placeholder="Ej: Edificio azul, preguntar en recepción del 3er piso"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-brand-500"
          />
          {isPending && <p className="text-brand-500 text-xs mt-1">Guardando...</p>}
        </div>

        {/* Orders history */}
        {customer.orders.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Últimos pedidos</p>
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs">
                <tr>
                  <th className="text-left pb-2">Folio</th>
                  <th className="text-left pb-2">Fecha</th>
                  <th className="text-left pb-2">Estado</th>
                  <th className="text-right pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customer.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 font-medium text-brand-500">#{o.orderNumber}</td>
                    <td className="py-2 text-gray-500">{new Date(o.createdAt).toLocaleDateString('es-MX')}</td>
                    <td className="py-2 text-gray-500">{o.status}</td>
                    <td className="py-2 text-right font-semibold">${o.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
