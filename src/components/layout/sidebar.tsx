'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, Building2, Sparkles, Settings, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/turnovers', label: 'Missions', icon: Calendar },
  { href: '/finances', label: 'Finances', icon: Wallet },
];

const GESTION_NAV = [
  { href: '/appartements', label: 'Appartements', icon: Building2 },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/cleaners', label: 'Équipe', icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-bg-primary min-h-screen fixed left-0 top-0 z-40 border-r border-border">
      {/* Logo — click to go to Dashboard */}
      <Link href="/" className="px-5 py-4 border-b border-border flex items-center gap-3 hover:bg-bg-hover transition-colors">
        <Image src="/logo-spotless.png" alt="SPOTLESS" width={40} height={40} className="rounded-lg" />
        <div>
          <h1 className="font-heading text-lg font-bold text-accent-dark tracking-tight">
            SPOTLESS
          </h1>
          <p className="text-[10px] text-text-muted">Gestion turnover</p>
        </div>
      </Link>

      {/* Main Nav */}
      <nav className="flex-1 px-3 pt-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold text-text-muted uppercase tracking-widest">Raccourcis</p>
          <div className="space-y-0.5">
            {MAIN_NAV.map(item => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-accent-bg text-accent-dark'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold text-text-muted uppercase tracking-widest">Gestion</p>
          <div className="space-y-0.5">
            {GESTION_NAV.map(item => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-accent-bg text-accent-dark'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Settings */}
      <div className="px-3 py-3 border-t border-border">
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <Settings size={18} strokeWidth={1.8} />
          Paramètres
        </Link>
      </div>
    </aside>
  );
}
