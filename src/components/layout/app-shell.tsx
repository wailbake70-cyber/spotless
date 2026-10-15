'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomTabs } from './bottom-tabs';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <Header />
      <main className="lg:ml-60 pb-20 lg:pb-0 min-h-dvh">
        {children}
      </main>
      <BottomTabs />
    </>
  );
}
