'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useBranch, useUpdateBranch, useMenuSchedules, useUpsertMenuSchedules,
  useProductAvailability, useUpdateProductAvailability,
  useDevices, useApproveDevice, useBlockDevice,
} from '@/hooks/use-branches';
import { useMenus } from '@/hooks/use-menus';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DEVICE_TYPE_LABELS: Record<string, string> = { RECEPTION: 'Recepción', KITCHEN: 'Cocina', DELIVERY: 'Repartidor' };
const DEVICE_STATUS_LABELS: Record<string, string> = { PENDING: 'Pendiente', ACTIVE: 'Activo', BLOCKED: 'Bloqueado' };
const TABS = ['Info', 'Menús', 'Platillos', 'Dispositivos'] as const;
type Tab = typeof TABS[number];

export default function SucursalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Info');

  const { data: branch, isLoading } = useBranch(id);
  const updateBranch = useUpdateBranch(id);
  const { data: schedules = [] } = useMenuSchedules(id);
  const upsertSchedules = useUpsertMenuSchedules(id);
  const { data: menus = [] } = useMenus();
  const { data: availability = [] } = useProductAvailability(id);
  const updateAvailability = useUpdateProductAvailability(id);
  const { data: devices = [] } = useDevices();
  const approveDevice = useApproveDevice();
  const blockDevice = useBlockDevice();

  const branchDevices = devices.filter((d) => !d.branch || d.branch?.id === id);

  const [info, setInfo] = useState({ name: '', address: '', phone: '', latitude: '', longitude: '' });
  useEffect(() => {
    if (branch) {
      setInfo({
        name: branch.name,
        address: branch.address,
        phone: branch.phone ?? '',
        latitude: branch.latitude.toString(),
        longitude: branch.longitude.toString(),
      });
    }
  }, [branch]);

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  if (!branch) return <div className="p-8 text-sm text-red-500">Sucursal no encontrada</div>;

  const scheduleMap = new Map(schedules.map((s) => [s.menuId, s]));

  const toggleMenuDay = async (menuId: string, day: number) => {
    const current = scheduleMap.get(menuId);
    const currentDays = current?.daysOfWeek ?? [];
    const newDays = currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort((a, b) => a - b);
    await upsertSchedules.mutateAsync([{ menuId, isActive: current?.isActive ?? true, daysOfWeek: newDays }]);
  };

  const toggleMenuActive = async (menuId: string, isActive: boolean) => {
    const current = scheduleMap.get(menuId);
    await upsertSchedules.mutateAsync([{ menuId, isActive, daysOfWeek: current?.daysOfWeek ?? [] }]);
  };

  const toggleProductAvailability = async (productId: string, isAvailable: boolean) => {
    await updateAvailability.mutateAsync([{ productId, isAvailable }]);
  };

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Sucursales</button>
      <h1 className="text-2xl font-black text-gray-900 mb-6">{branch.name}</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-[#FF6B35] text-[#FF6B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Info' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await updateBranch.mutateAsync({
              name: info.name,
              address: info.address,
              phone: info.phone || undefined,
              latitude: parseFloat(info.latitude),
              longitude: parseFloat(info.longitude),
            });
          }}
          className="flex flex-col gap-4"
        >
          {[
            { label: 'Nombre', key: 'name' as const },
            { label: 'Dirección', key: 'address' as const },
            { label: 'Teléfono', key: 'phone' as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={info[key]}
                onChange={(e) => setInfo((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
              />
            </div>
          ))}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">Coordenadas GPS</label>
              <button
                type="button"
                onClick={() => navigator.geolocation.getCurrentPosition((p) => setInfo((f) => ({ ...f, latitude: p.coords.latitude.toString(), longitude: p.coords.longitude.toString() })))}
                className="text-xs text-[#FF6B35] hover:underline"
              >
                Usar mi ubicación
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={info.latitude} onChange={(e) => setInfo((f) => ({ ...f, latitude: e.target.value }))} placeholder="Latitud" type="number" step="any" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={info.longitude} onChange={(e) => setInfo((f) => ({ ...f, longitude: e.target.value }))} placeholder="Longitud" type="number" step="any" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={updateBranch.isPending} className="self-end bg-[#FF6B35] text-white rounded-lg px-6 py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50">
            {updateBranch.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      )}

      {tab === 'Menús' && (
        <div className="space-y-3">
          {menus.map((menu) => {
            const schedule = scheduleMap.get(menu.id);
            const isActive = schedule?.isActive ?? false;
            return (
              <div key={menu.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{menu.name}</p>
                    <p className="text-xs text-gray-400">{menu.type === 'FIXED' ? 'Fijo' : 'Por día'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={(e) => toggleMenuActive(menu.id, e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5 bg-gray-200 peer-checked:bg-[#FF6B35] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
                {menu.type !== 'FIXED' && isActive && (
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map((d, i) => {
                      const active = schedule?.daysOfWeek?.includes(i) ?? false;
                      return (
                        <button
                          key={i}
                          onClick={() => toggleMenuDay(menu.id, i)}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${active ? 'bg-[#FF6B35] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {menus.length === 0 && <p className="text-sm text-gray-400">No hay menús configurados en este negocio.</p>}
        </div>
      )}

      {tab === 'Platillos' && (
        <div className="space-y-2">
          {availability.map((item) => (
            <div key={item.productId} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-400">{item.categoryName}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.hasOverride && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">Override</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.branchAvailable}
                    onChange={(e) => toggleProductAvailability(item.productId, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-[#FF6B35] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>
          ))}
          {availability.length === 0 && <p className="text-sm text-gray-400">No hay platillos en este negocio.</p>}
        </div>
      )}

      {tab === 'Dispositivos' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_90px_100px_90px] px-4 py-2 bg-gray-50 border-b border-gray-200">
              {['Nombre', 'Tipo', 'Status', 'Última conexión', ''].map((h) => (
                <span key={h} className="text-[10px] font-bold text-gray-500 uppercase">{h}</span>
              ))}
            </div>
            {branchDevices.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Sin dispositivos registrados</div>
            ) : branchDevices.map((device) => (
              <div key={device.id} className="grid grid-cols-[1fr_90px_90px_100px_90px] px-4 py-3 items-center border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium text-gray-800">{device.name}</span>
                <span className="text-xs text-gray-600">{DEVICE_TYPE_LABELS[device.deviceType]}</span>
                <span className={`text-xs font-bold ${device.status === 'ACTIVE' ? 'text-green-600' : device.status === 'PENDING' ? 'text-amber-600' : 'text-red-600'}`}>
                  {DEVICE_STATUS_LABELS[device.status]}
                </span>
                <span className="text-xs text-gray-400">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleDateString('es-MX') : '—'}</span>
                <div className="flex gap-1">
                  {device.status === 'PENDING' && (
                    <button onClick={() => approveDevice.mutate({ id: device.id, branchId: id })} className="text-[11px] px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">Aprobar</button>
                  )}
                  {device.status === 'ACTIVE' && (
                    <button onClick={() => blockDevice.mutate(device.id)} className="text-[11px] px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100">Bloquear</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
