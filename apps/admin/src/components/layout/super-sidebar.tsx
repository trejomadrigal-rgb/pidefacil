'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { href: '/super/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/super/negocios', icon: Building2, label: 'Negocios' },
  { href: '/super/planes', icon: CreditCard, label: 'Planes' },
];

export function SuperSidebar() {
  const pathname = usePathname();
  const clearAuth = useAuthStore((s) => s.clearAuth);

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
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35] border-r-2 border-[#FF6B35]'
                  : 'text-white/55 hover:text-white/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <button
          onClick={() => {
            clearAuth();
            window.location.href = '/login';
          }}
          className="text-white/40 text-xs hover:text-white/70 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
