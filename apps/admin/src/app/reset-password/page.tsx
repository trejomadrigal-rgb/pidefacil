'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Suspense } from 'react';

const schema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});
type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      await api.post('/auth/reset-password', {
        email,
        code: values.code,
        newPassword: values.newPassword,
      });
      router.push('/login');
    } catch {
      setErrorMsg('Código incorrecto o expirado');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="bg-white rounded-[20px] shadow-lg p-9 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-jakarta text-3xl font-extrabold text-brand-900">
            Pide<span className="text-brand-500">Fácil</span>
          </h1>
          <p className="text-xl font-bold text-gray-800 mt-3">Nueva contraseña</p>
          {email && (
            <p className="text-sm text-gray-400 mt-1">
              Ingresa el código que enviamos a{' '}
              <span className="font-medium text-gray-600">{email}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="code" className="text-sm font-semibold text-gray-700">
              Código de verificación
            </Label>
            <Input
              id="code"
              type="text"
              placeholder="123456"
              maxLength={6}
              className="mt-1 h-12 rounded-xl bg-gray-50 text-center text-xl font-bold tracking-widest"
              {...register('code')}
            />
            {errors.code && (
              <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="newPassword" className="text-sm font-semibold text-gray-700">
              Nueva contraseña
            </Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="h-12 rounded-xl bg-gray-50 pr-10"
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>
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
            {isSubmitting ? 'Cambiando…' : 'Cambiar contraseña'}
          </Button>
        </form>

        <div className="text-center mt-5">
          <Link
            href="/login"
            className="text-sm text-brand-500 hover:underline font-medium"
          >
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
