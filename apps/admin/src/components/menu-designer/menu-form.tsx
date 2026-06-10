'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useUpdateMenu,
  usePublishMenu,
  useDeleteMenu,
  type Menu,
} from '@/hooks/use-menus';
import { useMenuDesignerStore } from '@/store/menu-designer.store';

const menuFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(['FIXED', 'DAILY', 'WEEKLY', 'SPECIAL']),
});
type MenuFormValues = z.infer<typeof menuFormSchema>;

const MENU_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fijo',
  DAILY: 'Del día',
  WEEKLY: 'Semanal',
  SPECIAL: 'Especial',
};

interface MenuFormProps {
  menu: Menu;
}

export function MenuForm({ menu }: MenuFormProps) {
  const updateMenu = useUpdateMenu(menu.id);
  const publishMenu = usePublishMenu(menu.id);
  const deleteMenu = useDeleteMenu(menu.id);
  const { clearSelection } = useMenuDesignerStore();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<MenuFormValues>({
    resolver: zodResolver(menuFormSchema),
    defaultValues: { name: menu.name, type: menu.type },
  });

  // Sync form when a different menu is selected
  useEffect(() => {
    reset({ name: menu.name, type: menu.type });
  }, [menu.id, reset]);

  const onSave = async (values: MenuFormValues) => {
    try {
      await updateMenu.mutateAsync(values);
      reset(values);
    } catch {
      // error surfaced in updateMenu.error
    }
  };

  const onDelete = async () => {
    if (!confirm(`¿Eliminar "${menu.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteMenu.mutateAsync();
      clearSelection();
    } catch {
      // error surfaced in deleteMenu.error
    }
  };

  const onPublishToggle = async () => {
    try {
      await publishMenu.mutateAsync();
    } catch {
      // error surfaced in publishMenu.error
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            Mis Menús <span className="mx-1">/</span>
            <span className="text-brand-500">{menu.name}</span>
          </p>
          <h2 className="font-jakarta font-bold text-brand-900 text-sm mt-0.5">{menu.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-red-300 text-red-500 hover:bg-red-50 rounded-lg"
            onClick={onDelete}
            disabled={deleteMenu.isPending}
          >
            Eliminar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-brand-500 hover:bg-brand-700 text-white rounded-lg"
            onClick={onPublishToggle}
            disabled={publishMenu.isPending}
          >
            {menu.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit(onSave)} className="max-w-md space-y-5">
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nombre</Label>
            <Input
              {...register('name')}
              className="h-11 rounded-xl"
              placeholder="Ej. Menú del día"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Tipo</Label>
            <Select
              defaultValue={menu.type}
              onValueChange={(v) =>
                setValue('type', v as MenuFormValues['type'], { shouldDirty: true })
              }
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MENU_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Estado</Label>
            <Badge
              className={
                menu.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }
              variant="outline"
            >
              {menu.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
            </Badge>
          </div>

          <Separator />

          <Button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="w-full h-11 bg-brand-500 hover:bg-brand-700 text-white rounded-xl font-semibold"
          >
            Guardar cambios
          </Button>
        </form>
      </div>
    </div>
  );
}
