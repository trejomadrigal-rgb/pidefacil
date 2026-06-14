'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  email: z.string().email('Email inválido'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      await api.post('/auth/forgot-password', { email: values.email });
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch {
      setErrorMsg('No encontramos una cuenta con ese email');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="bg-white rounded-[20px] shadow-lg p-9 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-jakarta text-3xl font-extrabold text-brand-900">
            Pide<span className="text-brand-500">Fácil</span>
          </h1>
          <p className="text-xl font-bold text-gray-800 mt-3">Recuperar contraseña</p>
          <p className="text-sm text-gray-400 mt-1">
            Te enviaremos un código de 6 dígitos a tu correo.
          </p>
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
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
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
            {isSubmitting ? 'Enviando…' : 'Enviar código'}
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
