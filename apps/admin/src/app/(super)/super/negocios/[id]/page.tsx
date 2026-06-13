'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useActivateSaBusiness,
  useSaBusiness,
  useSaPlans,
  useSuspendSaBusiness,
  useUpdateSaBusiness,
  useUpsertSaSubscription,
} from '@/hooks/use-super-admin';
import type { SaSubscription } from '@/api/super-admin';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  INACTIVE: 'Inactivo',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-red-100 text-red-600',
  INACTIVE: 'bg-gray-100 text-gray-500',
};

const inputClass =
  'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]';

export default function NegocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: biz, isLoading } = useSaBusiness(id);
  const { data: plans = [] } = useSaPlans();
  const updateBiz = useUpdateSaBusiness();
  const suspend = useSuspendSaBusiness();
  const activate = useActivateSaBusiness();
  const upsertSub = useUpsertSaSubscription();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  const [subPlanId, setSubPlanId] = useState('');
  const [subStartDate, setSubStartDate] = useState('');
  const [subEndDate, setSubEndDate] = useState('');
  const [subStatus, setSubStatus] = useState<SaSubscription['status']>('TRIAL');

  const handleStartEdit = () => {
    if (!biz) return;
    setEditName(biz.name);
    setEditPhone(biz.phone);
    setEditWhatsapp(biz.whatsapp ?? '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    await updateBiz.mutateAsync({
      id,
      data: { name: editName, phone: editPhone, whatsapp: editWhatsapp || undefined },
    });
    setIsEditing(false);
  };

  const handleUpsertSub = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertSub.mutateAsync({
      businessId: id,
      planId: subPlanId,
      startDate: subStartDate,
      endDate: subEndDate || undefined,
      status: subStatus,
    });
  };

  if (isLoading || !biz) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  }

  return (
    <div className="p-8 max-w-2xl space-y-8">
      {/* Section 1: Business info */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-black text-gray-900">{biz.name}</h1>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              STATUS_BADGE[biz.status] ?? STATUS_BADGE.INACTIVE
            }`}
          >
            {STATUS_LABEL[biz.status] ?? biz.status}
          </span>
        </div>

        {!isEditing ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium text-gray-500 w-24 inline-block">Slug:</span>
              {biz.slug}
            </p>
            <p className="text-sm">
              <span className="font-medium text-gray-500 w-24 inline-block">Teléfono:</span>
              {biz.phone}
            </p>
            <p className="text-sm">
              <span className="font-medium text-gray-500 w-24 inline-block">WhatsApp:</span>
              {biz.whatsapp ?? '—'}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleStartEdit}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Editar
              </button>
              {biz.status !== 'SUSPENDED' ? (
                <button
                  onClick={() => {
                    if (confirm('¿Suspender este negocio?')) suspend.mutate(id);
                  }}
                  disabled={suspend.isPending}
                  className="text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50"
                >
                  Suspender
                </button>
              ) : (
                <button
                  onClick={() => activate.mutate(id)}
                  disabled={activate.isPending}
                  className="text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 disabled:opacity-50"
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            {(
              [
                { label: 'Nombre', value: editName, onChange: (v: string) => setEditName(v) },
                { label: 'Teléfono', value: editPhone, onChange: (v: string) => setEditPhone(v) },
                {
                  label: 'WhatsApp',
                  value: editWhatsapp,
                  onChange: (v: string) => setEditWhatsapp(v),
                },
              ] as const
            ).map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="text-xs font-medium text-gray-500">{label}</label>
                <input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateBiz.isPending}
                className="text-sm bg-[#FF6B35] text-white rounded-lg px-3 py-1.5 hover:bg-[#e55a2b] disabled:opacity-50"
              >
                {updateBiz.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Subscription */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Suscripción</h2>

        {biz.subscription && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 text-sm space-y-1">
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Plan:</span>
              {biz.subscription.plan?.name ?? '—'}
            </p>
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Estado:</span>
              {biz.subscription.status}
            </p>
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Inicio:</span>
              {new Date(biz.subscription.startDate).toLocaleDateString('es-MX')}
            </p>
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Vence:</span>
              {biz.subscription.endDate
                ? new Date(biz.subscription.endDate).toLocaleDateString('es-MX')
                : '—'}
            </p>
          </div>
        )}

        <form
          onSubmit={handleUpsertSub}
          className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {biz.subscription ? 'Actualizar suscripción' : 'Asignar suscripción'}
          </p>
          <div>
            <label className="text-xs font-medium text-gray-500">Plan</label>
            <select
              value={subPlanId}
              onChange={(e) => setSubPlanId(e.target.value)}
              required
              className={`${inputClass} mt-1`}
            >
              <option value="">Selecciona un plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.monthlyPrice}/mes
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Fecha inicio</label>
              <input
                type="date"
                value={subStartDate}
                onChange={(e) => setSubStartDate(e.target.value)}
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Fecha vencimiento</label>
              <input
                type="date"
                value={subEndDate}
                onChange={(e) => setSubEndDate(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Estado</label>
            <select
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value as SaSubscription['status'])}
              className={`${inputClass} mt-1`}
            >
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Activo</option>
              <option value="SUSPENDED">Suspendido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={upsertSub.isPending}
            className="w-full bg-[#FF6B35] text-white rounded-lg py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50"
          >
            {upsertSub.isPending ? 'Guardando...' : biz.subscription ? 'Actualizar' : 'Asignar'}
          </button>
        </form>
      </section>
    </div>
  );
}
