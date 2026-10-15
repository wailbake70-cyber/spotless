'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TypeBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/client';
import { formatMAD } from '@/lib/utils';
import { APARTMENT_TYPES, ACCESS_TYPES } from '@/lib/constants';
import type { Apartment, Client } from '@/lib/supabase/types';

export default function AppartementsPage() {
  const router = useRouter();
  const [apartments, setApartments] = useState<(Apartment & { client?: Client })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const [aptsRes, clientsRes] = await Promise.all([
      supabase.from('apartments').select('*, client:clients(*)').eq('is_active', true).order('name'),
      supabase.from('clients').select('*').eq('is_active', true).order('name'),
    ]);
    if (aptsRes.data) setApartments(aptsRes.data as any);
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  }

  async function handleCreate(formData: FormData) {
    const supabase = createClient();
    const { error } = await supabase.from('apartments').insert({
      client_id: formData.get('client_id') as string,
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      bedrooms: parseInt(formData.get('bedrooms') as string) || 1,
      neighborhood: formData.get('neighborhood') as string || null,
      address: formData.get('address') as string || null,
      price_menage: parseFloat(formData.get('price_menage') as string),
      cost_femme: parseFloat(formData.get('cost_femme') as string) || null,
      cost_transport: parseFloat(formData.get('cost_transport') as string) || null,
      cost_produits: parseFloat(formData.get('cost_produits') as string) || null,
      access_type: formData.get('access_type') as string || null,
      access_code: formData.get('access_code') as string || null,
      wifi_name: formData.get('wifi_name') as string || null,
      wifi_password: formData.get('wifi_password') as string || null,
      special_instructions: formData.get('special_instructions') as string || null,
    });
    if (!error) {
      setShowForm(false);
      loadData();
    }
  }

  const filtered = apartments.filter(apt => {
    const matchesSearch = apt.name.toLowerCase().includes(search.toLowerCase()) ||
      apt.neighborhood?.toLowerCase().includes(search.toLowerCase());
    const matchesClient = !filterClient || apt.client_id === filterClient;
    return matchesSearch && matchesClient;
  });

  // Group by client
  const grouped = filtered.reduce<Record<string, (Apartment & { client?: Client })[]>>((acc, apt) => {
    const key = apt.client?.name || 'Sans client';
    if (!acc[key]) acc[key] = [];
    acc[key].push(apt);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Appartements</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={18} />
          <span className="hidden sm:inline">Nouvel appart</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
          />
        </div>
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="">Tous les clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Apartment List (grouped by client) */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={<Building2 size={48} />}
          title="Aucun appartement"
          description="Ajoutez votre premier appartement"
          action={<Button onClick={() => setShowForm(true)}><Plus size={16} /> Ajouter</Button>}
        />
      ) : (
        Object.entries(grouped).map(([clientName, apts]) => (
          <section key={clientName}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{clientName}</h2>
            <div className="space-y-2">
              {apts.map(apt => {
                const margin = (Number(apt.price_menage) || 0) - (Number(apt.cost_femme) || 0) - (Number(apt.cost_transport) || 0) - (Number(apt.cost_produits) || 0) - (Number(apt.cost_pressing) || 0);
                return (
                  <Card key={apt.id} hover onClick={() => router.push(`/appartements/${apt.id}`)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-text-primary">{apt.name}</span>
                          <TypeBadge type={apt.type} />
                        </div>
                        <p className="text-sm text-gray-500">{apt.neighborhood || apt.address || '—'}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-accent-dark">{formatMAD(Number(apt.price_menage))}</div>
                        <div className="text-xs text-gray-500">Marge: {formatMAD(margin)}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouvel appartement" size="lg">
        <form action={handleCreate} className="space-y-4">
          <Select name="client_id" label="Client *" placeholder="Sélectionner..." options={clients.map(c => ({ value: c.id, label: c.name }))} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="name" label="Nom *" placeholder="ex: Pearl n26" required />
            <Select name="type" label="Type *" options={[...APARTMENT_TYPES]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="neighborhood" label="Quartier" placeholder="Guéliz" />
            <Input name="address" label="Adresse" placeholder="Résidence..." />
          </div>
          <Input name="bedrooms" label="Chambres" type="number" defaultValue="1" min="0" />

          <h3 className="font-semibold text-sm text-gray-700 pt-2">Tarifs (MAD)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input name="price_menage" label="Prix ménage *" type="number" placeholder="180" required />
            <Input name="cost_femme" label="Coût femme" type="number" placeholder="90" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="cost_transport" label="Transport" type="number" placeholder="15" />
            <Input name="cost_produits" label="Produits" type="number" placeholder="0" />
          </div>

          <h3 className="font-semibold text-sm text-gray-700 pt-2">Accès</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select name="access_type" label="Type d'accès" options={[...ACCESS_TYPES]} placeholder="—" />
            <Input name="access_code" label="Code" placeholder="1234" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="wifi_name" label="WiFi nom" placeholder="Fibre-XXX" />
            <Input name="wifi_password" label="WiFi mdp" placeholder="" />
          </div>
          <Textarea name="special_instructions" label="Instructions" placeholder="Notes spéciales..." />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button type="submit" className="flex-1">Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
