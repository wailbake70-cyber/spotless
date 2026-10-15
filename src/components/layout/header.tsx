'use client';

import Image from 'next/image';
import { Bell } from 'lucide-react';

export function Header() {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-bg-primary border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Image src="/logo-spotless.png" alt="SPOTLESS" width={32} height={32} className="rounded-lg" />
        <h1 className="font-heading text-lg font-bold text-accent-dark tracking-tight">
          SPOTLESS
        </h1>
      </div>
      <button className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors cursor-pointer">
        <Bell size={20} />
      </button>
    </header>
  );
}
