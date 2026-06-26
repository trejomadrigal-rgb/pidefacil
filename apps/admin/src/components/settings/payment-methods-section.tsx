'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from '@/hooks/use-payment-methods';
import type { BusinessPaymentMethod } from '@/api/payment-methods';

function AddForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState('');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const create = useCreatePaymentMethod();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await create.mutateAsync({ label: label.trim(), requiresConfirmation });
    setLabel('');
    setRequiresConfirmation(false);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-gray-50 rounded-xl space-y-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ej: Clip, Efectivo, Transferencia BBVA"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        maxLength={60}
        autoFocus
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={requiresConfirmation}
          onChange={(e) => setRequiresConfirmation(e.target.checked)}
          className="accent-brand-500"
        />
        Requiere confirmar pago antes de preparar
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-2 text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!label.trim() || create.isPending}
          className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {create.isPending ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
    </form>
  );
}

function EditForm({ method, onDone }: { method: BusinessPaymentMethod; onDone: () => void }) {
  const [label, setLabel] = useState(method.label);
  const [requiresConfirmation, setRequiresConfirmation] = useState(method.requiresConfirmation);
  const update = useUpdatePaymentMethod();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await update.mutateAsync({ id: method.id, data: { label: label.trim(), requiresConfirmation } });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 bg-gray-50 rounded-xl space-y-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        maxLength={60}
        autoFocus
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={requiresConfirmation}
          onChange={(e) => setRequiresConfirmation(e.target.checked)}
          className="accent-brand-500"
        />
        Requiere confirmar pago
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1.5 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={!label.trim() || update.isPending} className="flex-1 bg-brand-500 text-white rounded-lg py-1.5 text-sm font-semibold disabled:opacity-50">
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function MethodRow({ method }: { method: BusinessPaymentMethod }) {
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const update = useUpdatePaymentMethod();
  const remove = useDeletePaymentMethod();

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await remove.mutateAsync(method.id);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.status === 409
          ? 'Tiene pedidos asociados. Desactívala en lugar de eliminarla.'
          : 'No se pudo eliminar.';
      setDeleteError(msg);
    }
  };

  const handleToggle = () => {
    update.mutate({ id: method.id, data: { isActive: !method.isActive } });
  };

  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${method.isActive ? 'bg-brand-500' : 'bg-gray-200'}`}
          aria-label={method.isActive ? 'Desactivar' : 'Activar'}
        >
          <span
            className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${method.isActive ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
        <span className={`flex-1 text-sm font-medium ${method.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
          {method.label}
        </span>
        {method.requiresConfirmation && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ confirmar</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="text-gray-400 hover:text-brand-500 text-xs px-1"
          aria-label="Editar"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={remove.isPending}
          className="text-gray-400 hover:text-red-500 text-xs px-1 disabled:opacity-50"
          aria-label="Eliminar"
        >
          🗑️
        </button>
      </div>
      {deleteError && <p className="text-xs text-red-500 mt-1 ml-12">{deleteError}</p>}
      {editing && <EditForm method={method} onDone={() => setEditing(false)} />}
    </div>
  );
}

export function PaymentMethodsSection() {
  const { data: methods = [], isLoading } = usePaymentMethods();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
      <h2 className="font-jakarta font-bold text-brand-900 text-base mb-1">Formas de pago</h2>
      <p className="text-xs text-gray-400 mb-4">
        Define qué métodos acepta tu negocio. Solo los activos aparecerán en el menú.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : methods.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-400">Sin formas de pago configuradas.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {methods.map((m) => (
            <MethodRow key={m.id} method={m} />
          ))}
        </div>
      )}

      {showAdd ? (
        <AddForm onDone={() => setShowAdd(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-4 text-sm text-brand-500 font-semibold hover:text-brand-700 transition-colors"
        >
          + Agregar forma de pago
        </button>
      )}
    </div>
  );
}
