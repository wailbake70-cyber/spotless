'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(formData: FormData) {
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    });

    if (error) {
      setError(`Erreur: ${error.message}`);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo-spotless.png" alt="SPOTLESS" width={80} height={80} className="mx-auto mb-3 rounded-2xl" />
          <h1 className="font-heading text-2xl font-bold text-accent-dark tracking-tight">
            SPOTLESS
          </h1>
          <p className="text-xs text-text-muted mt-1">Rien ne nous échappe.</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form action={handleLogin} className="space-y-4">
            <Input
              name="email"
              label="Email"
              type="email"
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
            <Input
              name="password"
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          SPOTLESS Marrakech © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
