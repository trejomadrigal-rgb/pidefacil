'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, KeyRound, UserX, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  reactivateUser,
  type BusinessUser,
  type UserRole,
} from '@/api/users';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  OWNER:         { label: 'Dueño',        className: 'bg-purple-100 text-purple-700' },
  ADMIN:         { label: 'Admin',         className: 'bg-brand-100 text-brand-700' },
  OPERATOR:      { label: 'Operador',      className: 'bg-blue-100 text-blue-700' },
  KITCHEN:       { label: 'Cocina',        className: 'bg-yellow-100 text-yellow-700' },
  MENU_DESIGNER: { label: 'Diseño menú',   className: 'bg-pink-100 text-pink-700' },
  DELIVERY:      { label: 'Repartidor',    className: 'bg-green-100 text-green-700' },
};

const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'DELIVERY',      label: 'Repartidor' },
  { value: 'OPERATOR',      label: 'Operador' },
  { value: 'KITCHEN',       label: 'Cocina' },
  { value: 'ADMIN',         label: 'Admin' },
  { value: 'MENU_DESIGNER', label: 'Diseño de menú' },
];

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('DELIVERY');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => createUser({ name, email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Ocurrió un error. Intenta de nuevo.'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    mutate();
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 className="font-bold text-brand-900 text-lg mb-1">Nuevo usuario</h2>
      <p className="text-sm text-gray-500 mb-5">Crea acceso para un miembro de tu equipo.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Juan García"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Contraseña temporal</label>
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
          <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
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
            {isPending ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, onClose }: { user: BusinessUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role === 'OWNER' ? 'ADMIN' : user.role);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateUser(user.id, { name, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess(true);
    },
    onError: () => setError('Ocurrió un error. Intenta de nuevo.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutate();
  };

  return (
    <ModalShell onClose={onClose}>
      {success ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-bold text-brand-900 text-lg mb-1">Usuario actualizado</h2>
          <p className="text-sm text-gray-500 mb-5">Los datos de <span className="font-semibold">{name}</span> fueron actualizados.</p>
          <button onClick={onClose} className="w-full bg-brand-500 text-white rounded-xl py-2.5 font-semibold text-sm">Cerrar</button>
        </div>
      ) : (
        <>
          <h2 className="font-bold text-brand-900 text-lg mb-1">Editar usuario</h2>
          <p className="text-sm text-gray-500 mb-5">{user.email}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={user.role === 'OWNER'}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white disabled:opacity-60"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {user.role === 'OWNER' && (
                <p className="text-xs text-gray-400 mt-1">El rol de dueño no se puede cambiar.</p>
              )}
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm">Cancelar</button>
              <button type="submit" disabled={isPending} className="flex-1 bg-brand-500 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50">
                {isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </>
      )}
    </ModalShell>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: BusinessUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => resetUserPassword(user.id, password),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSuccess(true); },
    onError: () => setError('Ocurrió un error. Intenta de nuevo.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    mutate();
  };

  return (
    <ModalShell onClose={onClose}>
      {success ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-bold text-brand-900 text-lg mb-1">Contraseña actualizada</h2>
          <p className="text-sm text-gray-500 mb-5">La contraseña de <span className="font-semibold">{user.name}</span> fue cambiada.</p>
          <button onClick={onClose} className="w-full bg-brand-500 text-white rounded-xl py-2.5 font-semibold text-sm">Cerrar</button>
        </div>
      ) : (
        <>
          <h2 className="font-bold text-brand-900 text-lg mb-1">Cambiar contraseña</h2>
          <p className="text-sm text-gray-500 mb-5">Usuario: <span className="font-semibold text-gray-700">{user.name}</span></p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500" autoComplete="new-password" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar contraseña</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500" autoComplete="new-password" required />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm">Cancelar</button>
              <button type="submit" disabled={isPending} className="flex-1 bg-brand-500 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50">{isPending ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </>
      )}
    </ModalShell>
  );
}

// ─── Confirm Status Modal ─────────────────────────────────────────────────────

function ConfirmStatusModal({ user, onClose }: { user: BusinessUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isActive = user.status === 'ACTIVE';

  const { mutate, isPending } = useMutation({
    mutationFn: () => (isActive ? deactivateUser(user.id) : reactivateUser(user.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  return (
    <ModalShell onClose={onClose}>
      <div className="text-center">
        <div className="text-4xl mb-3">{isActive ? '⛔' : '✅'}</div>
        <h2 className="font-bold text-gray-900 text-lg mb-2">
          {isActive ? 'Desactivar usuario' : 'Reactivar usuario'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {isActive
            ? `${user.name} ya no podrá acceder al sistema.`
            : `${user.name} recuperará acceso al sistema.`}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm">
            Cancelar
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className={`flex-1 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50 ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isPending ? 'Procesando...' : isActive ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; user: BusinessUser }
  | { type: 'password'; user: BusinessUser }
  | { type: 'status'; user: BusinessUser }
  | null;

export default function UsersPage() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers });
  const [modal, setModal] = useState<ModalState>(null);

  const deliveryUsers = users.filter((u) => u.role === 'DELIVERY');
  const otherUsers = users.filter((u) => u.role !== 'DELIVERY');

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jakarta text-2xl font-bold text-brand-900">Usuarios</h1>
        <motion.button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </motion.button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-sm">No hay usuarios registrados.</p>
      ) : (
        <div className="space-y-8">
          {deliveryUsers.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Repartidores ({deliveryUsers.length})
              </h2>
              <UserTable users={deliveryUsers} onAction={setModal} />
            </section>
          )}

          {otherUsers.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Equipo ({otherUsers.length})
              </h2>
              <UserTable users={otherUsers} onAction={setModal} />
            </section>
          )}
        </div>
      )}

      <AnimatePresence>
        {modal?.type === 'create' && <CreateUserModal key="create" onClose={() => setModal(null)} />}
        {modal?.type === 'edit' && <EditUserModal key="edit" user={modal.user} onClose={() => setModal(null)} />}
        {modal?.type === 'password' && <ResetPasswordModal key="password" user={modal.user} onClose={() => setModal(null)} />}
        {modal?.type === 'status' && <ConfirmStatusModal key="status" user={modal.user} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── User Table ───────────────────────────────────────────────────────────────

function UserTable({
  users,
  onAction,
}: {
  users: BusinessUser[];
  onAction: (state: ModalState) => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[36%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
        </colgroup>
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
          {users.map((u, index) => {
            const roleCfg = ROLE_CONFIG[u.role];
            const isInactive = u.status === 'INACTIVE';
            return (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
                className={`transition-colors ${isInactive ? 'opacity-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${roleCfg.className}`}>
                    {roleCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isInactive ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                    {isInactive ? 'Inactivo' : 'Activo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onAction({ type: 'edit', user: u })}
                      title="Editar"
                      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onAction({ type: 'password', user: u })}
                      title="Cambiar contraseña"
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    {u.role !== 'OWNER' && (
                      <button
                        onClick={() => onAction({ type: 'status', user: u })}
                        title={isInactive ? 'Reactivar usuario' : 'Desactivar usuario'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isInactive
                            ? 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
