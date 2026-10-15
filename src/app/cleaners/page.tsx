'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Phone, Sparkles, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/client';
import { formatMAD } from '@/lib/utils';
import type { Cleaner } from '@/lib/supabase/types';

export default function CleanersPage() {
  const router = useRouter();
  const [cleaners, setCleaners] = useState<(Cleaner & { turnover_count?: number })[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCleaners();
  }, []);

  async function loadCleaners() {
    const supabase = createClient();
    const { data } = await supabase
      .from('cleaners')
      .select('*, turnovers(id)')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setCleaners(data.map(c => ({
        ...c,
        turnover_count: (c as any).turnovers?.length || 0,
      })));
    }
    setLoading(false);
  }

  async function handleCreate(formData: FormData) {
    const supabase = createClient();
    const { error } = await supabase.from('cleaners').insert({
      name: formData.get('name') as string,
      phone: formData.get('phone') as string || null,
      neighborhood: formData.get('neighborhood') as string || null,
      base_rate_studio: parseFloat(formData.get('base_rate_studio') as string) || 80,
      base_rate_2ch: parseFloat(formData.get('base_rate_2ch') as string) || 100,
      base_rate_3ch: parseFloat(formData.get('base_rate_3ch') as string) || 120,
      prime_qualite: parseFloat(formData.get('prime_qualite') as string) || 20,
      payment_day: formData.get('payment_day') as string || 'immediat',
      notes: formData.get('notes') as string || null,
    });

    if (!error) {
      setShowForm(false);
      loadCleaners();
    }
  }

  const filtered = cleaners.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.neighborhood?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Équipe</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={18} />
          <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
        />
      </div>

      {/* Cleaner List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} />}
          title="Aucune femme de ménage"
          description="Ajoutez votre première collaboratrice"
          action={<Button onClick={() => setShowForm(true)}><Plus size={16} /> Ajouter</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(cleaner => (
            <Card
              key={cleaner.id}
              hover
              onClick={() => router.push(`/cleaners/${cleaner.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-text-primary">{cleaner.name}</span>
                  </div>
                  {cleaner.neighborhood && (
                    <p className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={13} /> {cleaner.neighborhood}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-500">
                      {cleaner.turnover_count} turnover{(cleaner.turnover_count || 0) > 1 ? 's' : ''}
                    </span>
                    <Badge variant="gold">{cleaner.payment_day}</Badge>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-sm text-gray-600">
                    <div>{formatMAD(cleaner.base_rate_studio)} <span className="text-xs text-gray-400">studio</span></div>
                    <div>{formatMAD(cleaner.base_rate_2ch)} <span className="text-xs text-gray-400">2ch</span></div>
                  </div>
                </div>
                {cleaner.phone && (
                  <a
                    href={`tel:${cleaner.phone}`}
                    onClick={e => e.stopPropagation()}
                    className="p-2 text-accent-dark hover:bg-accent-bg rounded-lg transition-colors ml-2"
                  >
                    <Phone size={18} />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouvelle collaboratrice">
        <form action={handleCreate} className="space-y-4">
          <Input name="name" label="Nom *" placeholder="ex: Amal" required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="phone" label="Téléphone" placeholder="+212..." type="tel" />
            <Input name="neighborhood" label="Quartier" placeholder="Guéliz" />
          </div>

          <h3 className="font-semibold text-sm text-gray-700 pt-2">Tarifs (MAD)</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input name="base_rate_studio" label="Studio" type="number" defaultValue="80" />
            <Input name="base_rate_2ch" label="2 chambres" type="number" defaultValue="100" />
            <Input name="base_rate_3ch" label="3 chambres" type="number" defaultValue="120" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="prime_qualite" label="Prime qualité" type="number" defaultValue="20" />
            <Input name="payment_day" label="Jour paiement" defaultValue="immediat" />
          </div>
          <Textarea name="notes" label="Notes" placeholder="Notes..." />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button type="submit" className="flex-1">Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
