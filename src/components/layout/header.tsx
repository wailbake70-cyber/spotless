'use client';

import { Bell } from 'lucide-react';

export function Header() {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-brand-black px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-gold tracking-wide">SPOTLESS</h1>
      </div>
      <button className="p-2 text-gray-400 hover:text-brand-gold transition-colors cursor-pointer">
        <Bell size={20} />
      </button>
    </header>
  );
}
