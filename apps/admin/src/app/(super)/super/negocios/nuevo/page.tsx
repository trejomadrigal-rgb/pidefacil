'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateSaBusiness } from '@/hooks/use-super-admin';

const FIELDS = [
  { label: 'Nombre del negocio', key: 'businessName', type: 'text' },
  { label: 'Slug (URL)', key: 'slug', type: 'text' },
  { label: 'Teléfono', key: 'phone', type: 'tel' },
  { label: 'Nombre del owner', key: 'ownerName', type: 'text' },
  { label: 'Email del owner', key: 'ownerEmail', type: 'email' },
  { label: 'Contraseña del owner', key: 'ownerPassword', type: 'password' },
] as const;

type FormKey = (typeof FIELDS)[number]['key'];
type FormState = Record<FormKey, string>;

const EMPTY_FORM: FormState = {
  businessName: '',
  slug: '',
  phone: '',
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
};

export default function NuevoNegocioPage() {
  const router = useRouter();
  const { mutateAsync, isPending, error } = useCreateSaBusiness();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const set = (key: FormKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutateAsync(form);
    router.push(`/super/negocios/${res.business.id}`);
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Nuevo negocio</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {FIELDS.map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={set(key)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>
        ))}
        {error && (
          <p className="text-sm text-red-500">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Error al crear negocio'}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-[#FF6B35] text-white rounded-lg py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50"
          >
            {isPending ? 'Creando...' : 'Crear negocio'}
          </button>
        </div>
      </form>
    </div>
  );
}
