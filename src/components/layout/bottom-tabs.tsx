'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Plus, Building2, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/turnovers', label: 'Missions', icon: Calendar },
  { href: '/turnovers/nouveau', label: '', icon: Plus, isCenter: true },
  { href: '/appartements', label: 'Apparts', icon: Building2 },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/cleaners', label: 'Équipe', icon: Sparkles },
];

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-primary border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {TABS.map(tab => {
          const isActive = !tab.isCenter && (pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href)));
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <Link
                key="center"
                href={tab.href}
                className="flex items-center justify-center w-11 h-11 -mt-4 rounded-full bg-accent-dark text-white shadow-md hover:bg-accent transition-colors"
              >
                <Icon size={22} strokeWidth={2.5} />
              </Link>
            );
          }

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
