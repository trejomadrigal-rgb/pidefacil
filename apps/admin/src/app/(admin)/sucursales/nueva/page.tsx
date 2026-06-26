'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateBranch } from '@/hooks/use-branches';

export default function NuevaSucursalPage() {
  const router = useRouter();
  const { mutateAsync, isPending, error } = useCreateBranch();
  const [form, setForm] = useState({
    name: '', address: '', phone: '', latitude: '', longitude: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString(),
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutateAsync({
      name: form.name,
      address: form.address,
      phone: form.phone || undefined,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
    });
    router.push('/sucursales');
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Nueva sucursal</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {[
          { label: 'Nombre', key: 'name' as const, type: 'text', required: true },
          { label: 'Dirección', key: 'address' as const, type: 'text', required: true },
          { label: 'Teléfono (opcional)', key: 'phone' as const, type: 'tel', required: false },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={set(key)}
              required={required}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Coordenadas GPS</label>
            <button type="button" onClick={useMyLocation} className="text-xs text-[#FF6B35] font-medium hover:underline">
              Usar mi ubicación actual
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              placeholder="Latitud"
              value={form.latitude}
              onChange={set('latitude')}
              required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitud"
              value={form.longitude}
              onChange={set('longitude')}
              required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500">
            {(error as any)?.response?.data?.message ?? 'Error al crear sucursal'}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 bg-[#FF6B35] text-white rounded-lg py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50">
            {isPending ? 'Creando...' : 'Crear sucursal'}
          </button>
        </div>
      </form>
    </div>
  );
}
