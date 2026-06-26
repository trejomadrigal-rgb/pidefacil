'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusiness, useUpdateBusiness } from '@/hooks/use-business';

const MENU_COLOR_KEYS = ['naranja','verde','rojo','azul','morado','rosa','dorado','turquesa'] as const;
type MenuColorKey = typeof MENU_COLOR_KEYS[number];

const THEMES: { key: MenuColorKey; name: string; hex: string; emoji: string }[] = [
  { key: 'naranja',  name: 'Naranja',  hex: '#FF6B35', emoji: '🔥' },
  { key: 'verde',    name: 'Verde',    hex: '#27AE60', emoji: '🌿' },
  { key: 'rojo',     name: 'Rojo',     hex: '#E74C3C', emoji: '🌶️' },
  { key: 'azul',     name: 'Azul',     hex: '#2980B9', emoji: '💙' },
  { key: 'morado',   name: 'Morado',   hex: '#8E44AD', emoji: '💜' },
  { key: 'rosa',     name: 'Rosa',     hex: '#E91E8C', emoji: '🌸' },
  { key: 'dorado',   name: 'Dorado',   hex: '#F39C12', emoji: '✨' },
  { key: 'turquesa', name: 'Turquesa', hex: '#16A085', emoji: '🌊' },
];

const businessFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  description: z.string().optional(),
  hours: z.string().optional(),
  menuColor: z.enum(MENU_COLOR_KEYS).optional(),
});
type BusinessFormValues = z.infer<typeof businessFormSchema>;

export function BusinessForm() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      phone: '',
      address: '',
      logoUrl: '',
      description: '',
      hours: '',
      menuColor: undefined,
    },
  });

  const selectedColor = watch('menuColor');

  // Populate form when business data loads
  useEffect(() => {
    if (business) {
      reset({
        name: business.name,
        slug: business.slug,
        phone: business.phone ?? '',
        address: business.address ?? '',
        logoUrl: business.logoUrl ?? '',
        description: business.description ?? '',
        hours: business.hours ?? '',
        menuColor: (business.menuColor as MenuColorKey | undefined) ?? undefined,
      });
    }
  }, [business?.id, reset]);

  const onSubmit = async (values: BusinessFormValues) => {
    try {
      await updateBusiness.mutateAsync(values);
      reset(values);
    } catch {
      // error surfaced via updateBusiness.isError
    }
  };

  if (isLoading) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="font-jakarta text-brand-900">Mi Negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="font-jakarta font-bold text-brand-900">Mi Negocio</CardTitle>
        <p className="text-xs text-gray-400">Actualiza la información de tu negocio</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Nombre del negocio
            </Label>
            <Input
              {...register('name')}
              className="h-11 rounded-xl"
              placeholder="La Fonda de María"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Slug (URL pública)
            </Label>
            <div className="flex items-center h-11 border border-input rounded-xl overflow-hidden">
              <span className="px-3 text-xs text-gray-400 bg-gray-50 h-full flex items-center border-r border-input flex-shrink-0">
                pidefacil.mx/
              </span>
              <Input
                {...register('slug')}
                className="h-full border-0 rounded-none focus-visible:ring-0 text-sm"
                placeholder="mi-fonda"
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-red-500 mt-1">{errors.slug.message}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Teléfono</Label>
            <Input
              {...register('phone')}
              className="h-11 rounded-xl"
              placeholder="+52 55 1234 5678"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Dirección</Label>
            <Input
              {...register('address')}
              className="h-11 rounded-xl"
              placeholder="Calle y número"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Logo URL</Label>
            <Input
              {...register('logoUrl')}
              className="h-11 rounded-xl"
              placeholder="https://... (URL de tu logo)"
            />
            {errors.logoUrl && <p className="text-xs text-red-500 mt-1">{errors.logoUrl.message}</p>}
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Descripción</Label>
            <Input
              {...register('description')}
              className="h-11 rounded-xl"
              placeholder="Comida casera desde 1985"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Horario de atención
            </Label>
            <Input
              {...register('hours')}
              className="h-11 rounded-xl"
              placeholder="Lun–Vie 8:00–18:00"
            />
          </div>

          {/* Color del menú */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-2 block">
              Color del menú
            </Label>
            <p className="text-[10px] text-gray-400 mb-3">
              Este color se usa en el acento, precios y botones de tu menú QR.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((theme) => {
                const isSelected = selectedColor === theme.key || (!selectedColor && theme.key === 'naranja');
                return (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => setValue('menuColor', theme.key, { shouldDirty: true })}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: isSelected ? theme.hex : 'transparent',
                      background: isSelected ? `${theme.hex}10` : '#F9FAFB',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ background: theme.hex }}
                    />
                    <span className="text-[10px] font-semibold text-gray-600 leading-tight text-center">
                      {theme.emoji} {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="w-full h-11 bg-brand-500 hover:bg-brand-700 text-white rounded-xl font-semibold"
          >
            {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>

          {updateBusiness.isError && (
            <p className="text-xs text-red-500 text-center">
              Error al guardar. Intenta de nuevo.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
