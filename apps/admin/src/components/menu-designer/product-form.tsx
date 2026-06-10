'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useToggleAvailability,
  useUploadImage,
  type Product,
} from '@/hooks/use-products';
import { useMenuDesignerStore } from '@/store/menu-designer.store';

const productFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  price: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  isAvailable: z.boolean(),
  imageUrl: z.string().optional(),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: Product; // undefined = create mode
  categoryId: string;
  menuId: string;
  onClose: () => void; // called after successful create/delete to clear selection
}

export function ProductForm({ product, categoryId, menuId, onClose }: ProductFormProps) {
  const isEditing = !!product;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(product?.id ?? '');
  const deleteProduct = useDeleteProduct(product?.id ?? '');
  const toggleAvailability = useToggleAvailability(product?.id ?? '');
  const uploadImage = useUploadImage();
  const { clearSelection } = useMenuDesignerStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? 0,
      isAvailable: product?.isAvailable ?? true,
      imageUrl: product?.imageUrl ?? '',
    },
  });

  const imageUrl = watch('imageUrl');

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description ?? '',
        price: product.price,
        isAvailable: product.isAvailable,
        imageUrl: product.imageUrl ?? '',
      });
    }
  }, [product?.id, reset]);

  const onSave = async (values: ProductFormValues) => {
    try {
      if (isEditing) {
        await updateProduct.mutateAsync(values);
        reset(values);
      } else {
        await createProduct.mutateAsync({ ...values, categoryId });
        onClose();
      }
    } catch {
      // error in mutation .error
    }
  };

  const onDelete = async () => {
    if (!confirm(`¿Eliminar "${product?.name}"?`)) return;
    try {
      await deleteProduct.mutateAsync();
      clearSelection();
      onClose();
    } catch {
      // error in deleteProduct.error
    }
  };

  const onToggleAvailability = async () => {
    try {
      await toggleAvailability.mutateAsync();
    } catch {
      // error
    }
  };

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage.mutateAsync(file);
      setValue('imageUrl', url, { shouldDirty: true });
    } catch {
      // error
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            {isEditing ? 'Editando producto' : 'Nuevo producto'}
          </p>
          <h2 className="font-jakarta font-bold text-brand-900 text-sm mt-0.5">
            {isEditing ? product.name : 'Agregar producto'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-red-300 text-red-500 hover:bg-red-50 rounded-lg"
              onClick={onDelete}
              disabled={deleteProduct.isPending}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit(onSave)} className="max-w-md space-y-5">
          {/* Image upload */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Imagen</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-colors overflow-hidden"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Producto"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Upload size={24} className="text-gray-300" />
                  <p className="text-xs text-gray-400">
                    {uploadImage.isPending ? 'Subiendo…' : 'Subir imagen'}
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onImageUpload}
            />
          </div>

          {/* Name */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nombre</Label>
            <Input
              {...register('name')}
              className="h-11 rounded-xl"
              placeholder="Ej. Enchiladas verdes"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Descripción
            </Label>
            <Textarea
              {...register('description')}
              className="rounded-xl resize-none"
              rows={3}
              placeholder="Descripción opcional del producto"
            />
          </div>

          {/* Price */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Precio (MXN)
            </Label>
            <Input
              {...register('price', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className="h-11 rounded-xl"
              placeholder="0.00"
            />
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
          </div>

          {/* Availability toggle */}
          {isEditing && (
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Disponible</Label>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Visible para clientes en el QR
                </p>
              </div>
              <Switch
                checked={product.isAvailable}
                onCheckedChange={onToggleAvailability}
                disabled={toggleAvailability.isPending}
                className="data-[state=checked]:bg-brand-500"
              />
            </div>
          )}

          <Separator />

          <Button
            type="submit"
            disabled={(!isDirty && isEditing) || isSubmitting}
            className="w-full h-11 bg-brand-500 hover:bg-brand-700 text-white rounded-xl font-semibold"
          >
            {isEditing ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </form>
      </div>
    </div>
  );
}
