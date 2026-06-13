'use client';

import { useState } from 'react';
import {
  useCreateSaPlan,
  useDeleteSaPlan,
  useSaPlans,
  useUpdateSaPlan,
} from '@/hooks/use-super-admin';
import type { SaPlan } from '@/api/super-admin';

type EditRow = Omit<SaPlan, 'id'>;
const EMPTY_ROW: EditRow = { name: '', monthlyPrice: 0, maxUsers: 1, maxProducts: 1, maxBranches: 1 };

const inputClass =
  'border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#FF6B35]';

export default function PlanesPage() {
  const { data: plans = [], isLoading } = useSaPlans();
  const create = useCreateSaPlan();
  const update = useUpdateSaPlan();
  const del = useDeleteSaPlan();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow>(EMPTY_ROW);
  const [isCreating, setIsCreating] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(EMPTY_ROW);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEdit = (plan: SaPlan) => {
    setEditingId(plan.id);
    setEditRow({
      name: plan.name,
      monthlyPrice: Number(plan.monthlyPrice),
      maxUsers: plan.maxUsers,
      maxProducts: plan.maxProducts,
      maxBranches: plan.maxBranches,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await update.mutateAsync({ id: editingId, data: editRow });
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(newRow);
    setIsCreating(false);
    setNewRow(EMPTY_ROW);
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await del.mutateAsync(id);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message ?? 'No se puede eliminar este plan');
    }
  };

  const setEdit =
    <K extends keyof EditRow>(setter: React.Dispatch<React.SetStateAction<EditRow>>) =>
    (key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setter((r) => ({ ...r, [key]: key === 'name' ? e.target.value : Number(e.target.value) }));

  const COLS = 'grid-cols-[160px_90px_70px_90px_90px_110px]';

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Planes</h1>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e55a2b]"
          >
            + Nuevo plan
          </button>
        )}
      </div>

      {deleteError && (
        <p className="text-sm text-red-500 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`grid ${COLS} px-4 py-2 bg-gray-50 border-b border-gray-200`}>
          {['Nombre', 'Precio/mes', 'Usuarios', 'Productos', 'Branches', ''].map((h) => (
            <span key={h} className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-gray-400 text-center">Cargando...</div>
        ) : (
          <>
            {plans.map((plan) =>
              editingId === plan.id ? (
                <div
                  key={plan.id}
                  className={`grid ${COLS} px-4 py-2 gap-1 items-center border-b border-gray-100`}
                >
                  <input value={editRow.name} onChange={setEdit(setEditRow)('name')} className={inputClass} />
                  <input type="number" value={editRow.monthlyPrice} onChange={setEdit(setEditRow)('monthlyPrice')} className={inputClass} />
                  <input type="number" value={editRow.maxUsers} onChange={setEdit(setEditRow)('maxUsers')} min={1} className={inputClass} />
                  <input type="number" value={editRow.maxProducts} onChange={setEdit(setEditRow)('maxProducts')} min={1} className={inputClass} />
                  <input type="number" value={editRow.maxBranches} onChange={setEdit(setEditRow)('maxBranches')} min={1} className={inputClass} />
                  <div className="flex gap-1">
                    <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✕</button>
                    <button onClick={handleSaveEdit} disabled={update.isPending} className="text-xs px-2 py-1 bg-[#FF6B35] text-white rounded hover:bg-[#e55a2b] disabled:opacity-50">✓</button>
                  </div>
                </div>
              ) : (
                <div
                  key={plan.id}
                  className={`grid ${COLS} px-4 py-3 items-center border-b border-gray-100 last:border-0`}
                >
                  <span className="text-sm font-bold text-gray-800">{plan.name}</span>
                  <span className="text-sm text-gray-700">${plan.monthlyPrice}</span>
                  <span className="text-sm text-gray-600">{plan.maxUsers}</span>
                  <span className="text-sm text-gray-600">{plan.maxProducts}</span>
                  <span className="text-sm text-gray-600">{plan.maxBranches}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(plan)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Editar</button>
                    <button onClick={() => handleDelete(plan.id)} disabled={del.isPending} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">Eliminar</button>
                  </div>
                </div>
              ),
            )}

            {isCreating && (
              <form
                onSubmit={handleCreate}
                className={`grid ${COLS} px-4 py-2 gap-1 items-center border-t border-[#FF6B35]/30`}
              >
                <input placeholder="Nombre" value={newRow.name} onChange={setEdit(setNewRow)('name')} required className={inputClass} />
                <input type="number" placeholder="Precio" value={newRow.monthlyPrice || ''} onChange={setEdit(setNewRow)('monthlyPrice')} required min={0} className={inputClass} />
                <input type="number" placeholder="Users" value={newRow.maxUsers || ''} onChange={setEdit(setNewRow)('maxUsers')} required min={1} className={inputClass} />
                <input type="number" placeholder="Prods" value={newRow.maxProducts || ''} onChange={setEdit(setNewRow)('maxProducts')} required min={1} className={inputClass} />
                <input type="number" placeholder="Branch" value={newRow.maxBranches || ''} onChange={setEdit(setNewRow)('maxBranches')} required min={1} className={inputClass} />
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setIsCreating(false); setNewRow(EMPTY_ROW); }} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✕</button>
                  <button type="submit" disabled={create.isPending} className="text-xs px-2 py-1 bg-[#FF6B35] text-white rounded hover:bg-[#e55a2b] disabled:opacity-50">✓</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
