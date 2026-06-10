'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, UtensilsCrossed, Settings, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/menus', icon: UtensilsCrossed, label: 'Menús' },
  { href: '/settings', icon: Settings, label: 'Config.' },
  { href: '/users', icon: Users, label: 'Usuarios', disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { userName, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      const rfToken = document.cookie.match(/rf_token=([^;]+)/)?.[1];
      if (rfToken) await api.post('/auth/logout', { refresh_token: rfToken });
    } finally {
      document.cookie = 'rf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <aside className="w-[100px] h-screen bg-brand-900 flex flex-col items-center py-4 flex-shrink-0">
      <div className="text-brand-500 font-jakarta font-extrabold text-xl mb-6">PF</div>

      <nav className="flex-1 flex flex-col gap-1 w-full px-1">
        {navItems.map(({ href, icon: Icon, label, disabled }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={disabled ? '#' : href}
              className={cn(
                'flex flex-col items-center gap-1 py-3 rounded-lg text-[10px] font-medium transition-colors',
                active
                  ? 'bg-brand-500/15 text-brand-500 border-l-2 border-brand-500'
                  : 'text-gray-400 hover:text-white',
                disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex flex-col items-center gap-1 py-3 text-[10px] text-gray-400 hover:text-white transition-colors"
        title={userName ?? 'Salir'}
      >
        <LogOut size={18} />
        Salir
      </button>
    </aside>
  );
}
