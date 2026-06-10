'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
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
import { SortableList } from './sortable-list';
import {
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from '@/hooks/use-categories';
import {
  useProducts,
  useReorderProducts,
  type Product,
} from '@/hooks/use-products';
import { useMenuDesignerStore } from '@/store/menu-designer.store';
import { formatPrice } from '@/lib/utils';

const categoryFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface CategoryFormProps {
  category: Category;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
}

export function CategoryForm({ category, onAddProduct, onEditProduct }: CategoryFormProps) {
  const updateCategory = useUpdateCategory(category.id);
  const deleteCategory = useDeleteCategory(category.id);
  const reorderProducts = useReorderProducts();
  const { clearSelection } = useMenuDesignerStore();

  const { data: products = [] } = useProducts(category.id);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category.name, status: category.status },
  });

  useEffect(() => {
    reset({ name: category.name, status: category.status });
  }, [category.id, reset]);

  const onSave = async (values: CategoryFormValues) => {
    try {
      await updateCategory.mutateAsync(values);
      reset(values);
    } catch {
      // error surfaced in updateCategory.error
    }
  };

  const onDelete = async () => {
    if (!confirm(`¿Eliminar categoría "${category.name}"?`)) return;
    try {
      await deleteCategory.mutateAsync();
      clearSelection();
    } catch {
      // error surfaced in deleteCategory.error
    }
  };

  const handleProductReorder = (newItems: Product[]) => {
    reorderProducts.mutate(newItems.map((p, i) => ({ id: p.id, sortOrder: i })));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Categoría seleccionada</p>
          <h2 className="font-jakarta font-bold text-brand-900 text-sm mt-0.5">{category.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-red-300 text-red-500 hover:bg-red-50 rounded-lg"
            onClick={onDelete}
            disabled={deleteCategory.isPending}
          >
            Eliminar
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-8 text-xs bg-brand-500 hover:bg-brand-700 text-white rounded-lg"
            disabled={!isDirty || isSubmitting}
          >
            Guardar
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit(onSave)} className="space-y-5">
          <div className="max-w-md space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nombre</Label>
              <Input
                {...register('name')}
                className="h-11 rounded-xl"
                placeholder="Ej. Antojitos"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Estado</Label>
              <Select
                key={category.id}
                defaultValue={category.status}
                onValueChange={(v) =>
                  setValue('status', v as CategoryFormValues['status'], { shouldDirty: true })
                }
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activa</SelectItem>
                  <SelectItem value="INACTIVE">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Products list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-brand-900">
                Productos ({products.length})
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-brand-500 border-brand-500 hover:bg-brand-50 rounded-lg"
                onClick={onAddProduct}
              >
                <Plus size={12} className="mr-1" /> Agregar
              </Button>
            </div>

            {products.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                Sin productos. Agrega el primero.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <SortableList
                  items={products}
                  onReorder={handleProductReorder}
                  renderItem={(product) => (
                    <div
                      className="flex items-center gap-3 py-3 pr-3 border-b border-gray-100 last:border-0 cursor-pointer"
                      onClick={() => {
                        onEditProduct(product);
                      }}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 text-sm">
                          🍽️
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${
                            product.isAvailable ? 'text-brand-900' : 'text-gray-400'
                          }`}
                        >
                          {product.name}
                        </p>
                        <p className="text-[10px] text-gray-400">{formatPrice(product.price)}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          product.isAvailable
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}
                      >
                        {product.isAvailable ? 'Disp.' : 'No disp.'}
                      </Badge>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
