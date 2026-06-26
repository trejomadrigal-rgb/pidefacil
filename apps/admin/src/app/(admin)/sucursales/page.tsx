'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useBranches, useDeleteBranch } from '@/hooks/use-branches';

export default function SucursalesPage() {
  const { data: branches = [], isLoading } = useBranches();
  const deleteBranch = useDeleteBranch();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteBranch.mutateAsync(id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al eliminar sucursal');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Sucursales</h1>
        <Link
          href="/sucursales/nueva"
          className="bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e55a2b] transition-colors"
        >
          + Nueva sucursal
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : branches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No tienes sucursales configuradas</p>
          <p className="text-xs text-gray-400 mt-1">Agrega tu primera sucursal para habilitar el menú multi-ubicación</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="font-bold text-gray-900">{branch.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{branch.address}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${branch.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {branch.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/sucursales/${branch.id}`}
                  className="flex-1 text-center text-xs font-medium border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                >
                  Gestionar
                </Link>
                <button
                  onClick={() => handleDelete(branch.id)}
                  className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
