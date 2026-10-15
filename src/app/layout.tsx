import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPOTLESS — Gestion Ménage Turnover',
  description: 'Système de gestion interne pour ménage turnover Airbnb/Booking à Marrakech',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-bg-secondary font-body text-text-primary">
        <Suspense fallback={<div className="min-h-dvh bg-bg-secondary" />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
