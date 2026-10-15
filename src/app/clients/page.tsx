'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Phone, Building2, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, TypeBadge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/client';
import { CLIENT_TYPES, PAYMENT_METHODS, PAYMENT_FREQUENCIES } from '@/lib/constants';
import type { Client } from '@/lib/supabase/types';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<(Client & { apartment_count?: number })[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const supabase = createClient();
    const { data } = await supabase
      .from('clients')
      .select('*, apartments(id)')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setClients(data.map(c => ({
        ...c,
        apartment_count: (c as any).apartments?.length || 0,
      })));
    }
    setLoading(false);
  }

  async function handleCreateClient(formData: FormData) {
    const supabase = createClient();
    const { error } = await supabase.from('clients').insert({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string || null,
      phone: formData.get('phone') as string || null,
      email: formData.get('email') as string || null,
      type: formData.get('type') as string || 'conciergerie',
      payment_method: formData.get('payment_method') as string || 'cash',
      payment_frequency: formData.get('payment_frequency') as string || 'bi_mensuel',
      notes: formData.get('notes') as string || null,
    });

    if (!error) {
      setShowForm(false);
      loadClients();
    }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Clients</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={18} />
          <span className="hidden sm:inline">Nouveau client</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold bg-white"
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="Aucun client"
          description="Ajoutez votre premier client pour commencer"
          action={<Button onClick={() => setShowForm(true)}><Plus size={16} /> Ajouter</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(client => (
            <Card
              key={client.id}
              hover
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-brand-black truncate">{client.name}</span>
                    <TypeBadge type={client.type} />
                  </div>
                  {client.contact_name && (
                    <p className="text-sm text-gray-500">{client.contact_name}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Building2 size={13} />
                      {client.apartment_count} appart{(client.apartment_count || 0) > 1 ? 's' : ''}
                    </span>
                    <Badge variant="gold">{client.payment_method}</Badge>
                  </div>
                </div>
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    onClick={e => e.stopPropagation()}
                    className="p-2 text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-colors"
                  >
                    <Phone size={18} />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Client Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouveau client">
        <form action={handleCreateClient} className="space-y-4">
          <Input name="name" label="Nom *" placeholder="ex: Ayoub Immobilino" required />
          <Input name="contact_name" label="Contact" placeholder="Prénom du contact" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="phone" label="Téléphone" placeholder="+212..." type="tel" />
            <Input name="email" label="Email" placeholder="email@..." type="email" />
          </div>
          <Select name="type" label="Type" options={[...CLIENT_TYPES]} />
          <div className="grid grid-cols-2 gap-3">
            <Select name="payment_method" label="Paiement" options={[...PAYMENT_METHODS]} />
            <Select name="payment_frequency" label="Fréquence" options={[...PAYMENT_FREQUENCIES]} />
          </div>
          <Textarea name="notes" label="Notes" placeholder="Notes libres..." />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Créer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
