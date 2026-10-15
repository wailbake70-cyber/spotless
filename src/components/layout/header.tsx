'use client';

import { Bell } from 'lucide-react';

export function Header() {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-bg-primary border-b border-border px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="font-heading text-lg font-bold text-text-primary tracking-tight">
          SPOT<span className="text-accent-dark">LESS</span>
        </h1>
      </div>
      <button className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors cursor-pointer">
        <Bell size={20} />
      </button>
    </header>
  );
}
