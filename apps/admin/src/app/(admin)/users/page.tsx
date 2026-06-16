'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, resetUserPassword, type BusinessUser, type UserRole } from '@/api/users';

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  OWNER:         { label: 'Dueño',        className: 'bg-purple-100 text-purple-700' },
  ADMIN:         { label: 'Admin',         className: 'bg-brand-100 text-brand-700' },
  OPERATOR:      { label: 'Operador',      className: 'bg-blue-100 text-blue-700' },
  KITCHEN:       { label: 'Cocina',        className: 'bg-yellow-100 text-yellow-700' },
  MENU_DESIGNER: { label: 'Diseño menú',   className: 'bg-pink-100 text-pink-700' },
  DELIVERY:      { label: 'Repartidor',    className: 'bg-green-100 text-green-700' },
};

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: BusinessUser;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => resetUserPassword(user.id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess(true);
    },
    onError: () => setError('Ocurrió un error. Intenta de nuevo.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-bold text-brand-900 text-lg mb-1">Contraseña actualizada</h2>
            <p className="text-sm text-gray-500 mb-5">
              La contraseña de <span className="font-semibold">{user.name}</span> fue cambiada correctamente.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-brand-500 text-white rounded-xl py-2.5 font-semibold text-sm"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-bold text-brand-900 text-lg mb-1">Cambiar contraseña</h2>
            <p className="text-sm text-gray-500 mb-5">
              Usuario: <span className="font-semibold text-gray-700">{user.name}</span> ({user.email})
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-brand-500 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
                >
                  {isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers });
  const [resetTarget, setResetTarget] = useState<BusinessUser | null>(null);

  return (
    <div className="p-8 h-full overflow-auto">
      <h1 className="font-jakarta text-2xl font-bold text-brand-900 mb-6">Usuarios</h1>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-sm">No hay usuarios registrados.</p>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const role = ROLE_CONFIG[u.role];
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${role.className}`}>
                        {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setResetTarget(u)}
                        className="text-xs font-semibold text-brand-500 hover:text-brand-700 transition-colors"
                      >
                        Cambiar contraseña
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
