'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

const navItems = [
  { href: '/super/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/super/negocios', icon: Building2, label: 'Negocios' },
  { href: '/super/planes', icon: CreditCard, label: 'Planes' },
];

export function SuperSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

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
    <aside className="w-56 bg-[#1A1A2E] flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-5 border-b border-white/10">
        <span className="text-[#FF6B35] font-black text-base">PideFacil</span>
        <p className="text-white/40 text-[10px] mt-0.5">Super Admin</p>
      </div>
      <nav className="flex-1 py-3">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-[#FF6B35]' : 'text-white/55 hover:text-white/80'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="super-sidebar-active"
                  className="absolute inset-0 bg-[#FF6B35]/15 border-r-2 border-[#FF6B35]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="text-white/40 text-xs hover:text-white/70 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
