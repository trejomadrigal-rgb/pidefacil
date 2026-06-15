'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShifts, useCreateShift, useCloseShift } from '@/hooks/use-shifts';
import { useQuery } from '@tanstack/react-query';
import { getDeliveryUsers } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck } from 'lucide-react';

export default function TurnosPage() {
  const router = useRouter();
  const { data: shifts = [], isLoading } = useShifts();
  const { data: deliveryUsers = [] } = useQuery({ queryKey: ['delivery-users'], queryFn: getDeliveryUsers });
  const createShift = useCreateShift();
  const closeShift = useCloseShift();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const handleCreate = async () => {
    if (!selectedUserId) return;
    try {
      await createShift.mutateAsync({ deliveryUserId: selectedUserId });
      setOpen(false);
      setSelectedUserId('');
    } catch {
      // Error is shown via the mutation error state — dialog stays open
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Turnos de reparto</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-500 hover:bg-brand-600 text-white">
              <Truck className="w-4 h-4 mr-2" /> Abrir turno
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir nuevo turno</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar repartidor" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createShift.isError && (
                <p className="text-sm text-red-600">No se pudo abrir el turno. Intenta de nuevo.</p>
              )}
              <Button
                className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                onClick={handleCreate}
                disabled={!selectedUserId || createShift.isPending}
              >
                {createShift.isPending ? 'Abriendo...' : 'Abrir turno'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin turnos hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors"
              onClick={() => router.push(`/turnos/${shift.id}`)}
            >
              <div>
                <p className="font-bold text-gray-900">{shift.deliveryUser.name}</p>
                <p className="text-xs text-gray-500">
                  Abierto: {new Date(shift.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{shift.liquidations.length} salidas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={shift.status === 'OPEN' ? 'default' : 'secondary'}>
                  {shift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </Badge>
                {shift.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); closeShift.mutate(shift.id); }}
                  >
                    Cerrar turno
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
