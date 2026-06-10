'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableList } from './sortable-list';
import { useMenus, useCreateMenu, type Menu } from '@/hooks/use-menus';
import { useCategories, useReorderCategories, type Category } from '@/hooks/use-categories';
import { useMenuDesignerStore } from '@/store/menu-designer.store';
import { cn } from '@/lib/utils';

const createMenuSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(['FIXED', 'DAILY', 'WEEKLY', 'SPECIAL']),
});
type CreateMenuForm = z.infer<typeof createMenuSchema>;

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'bg-green-500',
  DRAFT: 'bg-gray-400',
};

export function TreePanel() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: menus = [], isLoading } = useMenus();
  const createMenu = useCreateMenu();
  const { selectedMenuId, selectedCategoryId, selectMenu, selectCategory, togglePreview } =
    useMenuDesignerStore();

  const { data: categories = [] } = useCategories(selectedMenuId ?? undefined);
  const reorderCategories = useReorderCategories();

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } =
    useForm<CreateMenuForm>({ resolver: zodResolver(createMenuSchema), defaultValues: { type: 'FIXED' } });

  const onCreateMenu = async (values: CreateMenuForm) => {
    await createMenu.mutateAsync(values);
    setCreateOpen(false);
  };

  const handleCategoryReorder = (newItems: Category[]) => {
    reorderCategories.mutate(newItems.map((c, i) => ({ id: c.id, sortOrder: i })));
  };

  return (
    <div className="w-[240px] bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="font-jakarta font-bold text-brand-900 text-sm">Mis Menús</span>
        <Button
          size="sm"
          className="h-7 px-2 text-xs bg-brand-500 hover:bg-brand-700 text-white rounded-lg"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={12} className="mr-1" /> Nuevo
        </Button>
      </div>

      {/* Menu list */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && <p className="text-xs text-gray-400 px-4 py-2">Cargando…</p>}
        {menus.map((menu: Menu) => {
          const isActive = menu.id === selectedMenuId;
          return (
            <div key={menu.id}>
              <button
                onClick={() => selectMenu(menu.id)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2 text-left transition-colors',
                  isActive
                    ? 'bg-brand-50 border-l-2 border-brand-500'
                    : 'hover:bg-gray-50',
                )}
              >
                <span className={cn('text-xs font-semibold', isActive ? 'text-brand-900' : 'text-gray-600')}>
                  {isActive ? <ChevronDown size={12} className="inline mr-1" /> : <ChevronRight size={12} className="inline mr-1" />}
                  {menu.name}
                </span>
                <span className={cn('text-white text-[9px] px-1.5 py-0.5 rounded-full', STATUS_BADGE[menu.status] ?? 'bg-gray-400')}>
                  {menu.status === 'PUBLISHED' ? 'Pub.' : 'Draft'}
                </span>
              </button>

              {isActive && (
                <div className="pb-2">
                  <SortableList
                    items={categories}
                    onReorder={handleCategoryReorder}
                    renderItem={(cat) => (
                      <button
                        onClick={() => selectCategory(cat.id)}
                        className={cn(
                          'w-full text-left text-xs py-1.5 pr-2 truncate transition-colors',
                          selectedCategoryId === cat.id
                            ? 'text-brand-500 font-semibold'
                            : 'text-gray-500 hover:text-gray-800',
                        )}
                      >
                        📁 {cat.name}
                      </button>
                    )}
                    className="pl-6"
                  />
                  <button
                    onClick={() => {}}
                    className="pl-8 text-[11px] text-brand-500 hover:text-brand-700 mt-1"
                  >
                    + Categoría
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview button */}
      <div className="p-3 border-t border-gray-200">
        <Button
          variant="outline"
          className="w-full h-9 text-xs bg-brand-900 text-white border-0 hover:bg-brand-900/90 rounded-xl"
          onClick={togglePreview}
        >
          <Eye size={14} className="mr-1" /> Ver Preview QR
        </Button>
      </div>

      {/* Create Menu Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Menú</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateMenu)} className="space-y-4">
            <div>
              <Input placeholder="Nombre del menú" {...register('name')} className="h-11 rounded-xl" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <Select onValueChange={(v) => setValue('type', v as CreateMenuForm['type'])} defaultValue="FIXED">
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Fijo</SelectItem>
                <SelectItem value="DAILY">Del día</SelectItem>
                <SelectItem value="WEEKLY">Semanal</SelectItem>
                <SelectItem value="SPECIAL">Especial</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-brand-500 hover:bg-brand-700 text-white">
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
