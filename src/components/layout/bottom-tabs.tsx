'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Plus, Building2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/turnovers', label: 'Turnovers', icon: Calendar },
  { href: '/turnovers/nouveau', label: '', icon: Plus, isCenter: true },
  { href: '/appartements', label: 'Apparts', icon: Building2 },
  { href: '/clients', label: 'Clients', icon: Sparkles },
];

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {TABS.map(tab => {
          const isActive = !tab.isCenter && (pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href)));
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <Link
                key="center"
                href={tab.href}
                className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-brand-gold text-brand-black shadow-lg hover:bg-brand-gold-light transition-colors"
              >
                <Icon size={24} strokeWidth={2.5} />
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 min-w-[60px]',
                isActive ? 'text-brand-gold' : 'text-gray-400'
              )}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
