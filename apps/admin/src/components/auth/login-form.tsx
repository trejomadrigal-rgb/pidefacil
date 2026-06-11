'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      const { data } = await api.post('/auth/login', values);
      // Store refresh token in cookie (NOT httpOnly — browser-set)
      document.cookie = `rf_token=${data.refresh_token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Strict`;
      setAuth({
        accessToken: data.access_token,
        businessId: data.business.id,
        businessSlug: data.business.slug,
        userName: data.user.name,
      });
      router.push('/dashboard');
    } catch {
      setErrorMsg('Correo o contraseña incorrectos');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="bg-white rounded-[20px] shadow-lg p-9 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-jakarta text-3xl font-extrabold text-brand-900">
            Pide<span className="text-brand-500">Fácil</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Panel Administrativo</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="hola@mifonda.com"
              className="mt-1 h-12 rounded-xl bg-gray-50"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="mt-1 h-12 rounded-xl bg-gray-50"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-700 text-white font-bold text-base"
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
