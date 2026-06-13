'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { parseJwtPayload } from '@/lib/api';
import { SuperSidebar } from './super-sidebar';

function decodeRole(token: string | null): string | null {
  if (!token) return null;
  try {
    return parseJwtPayload(token).role ?? null;
  } catch {
    return null;
  }
}

export function SuperShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    const role = decodeRole(accessToken);
    if (role !== null && role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    } else if (accessToken === null) {
      router.replace('/login');
    }
  }, [accessToken, router]);

  return (
    <div className="flex h-screen overflow-hidden">
      <SuperSidebar />
      <main className="flex-1 overflow-auto bg-[#F5F5F5] h-full">{children}</main>
    </div>
  );
}
