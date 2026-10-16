'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Wallet, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/turnovers', label: 'Missions', icon: Calendar },
  { href: '/finances', label: 'Finances', icon: Wallet },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/cleaners', label: 'Équipe', icon: Sparkles },
];

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-primary border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {TABS.map(tab => {
          const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-1.5 py-1 min-w-[48px]',
                isActive ? 'text-accent-dark' : 'text-text-muted'
              )}
            >
              <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
