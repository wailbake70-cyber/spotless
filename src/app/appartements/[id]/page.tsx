'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Copy, Key, Wifi, MapPin, DollarSign, Calendar, Wrench } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, TypeBadge, StatusBadge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort, calcMargin, calcMarginPct } from '@/lib/utils';
import { APARTMENT_TYPES, ACCESS_TYPES } from '@/lib/constants';
import type { Apartment, Client, Turnover } from '@/lib/supabase/types';

type Tab = 'info' | 'tarifs' | 'acces' | 'historique';

export default function ApartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [apt, setApt] = useState<(Apartment & { client?: Client }) | null>(null);
  const [turnovers, setTurnovers] = useState<Turnover[]>([]);
  const [tab, setTab] = useState<Tab>('info');
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApartment();
  }, [params.id]);

  async function loadApartment() {
    const supabase = createClient();
    const id = params.id as string;

    const [aptRes, turnoversRes] = await Promise.all([
      supabase.from('apartments').select('*, client:clients(*)').eq('id', id).single(),
      supabase.from('turnovers')
        .select('*, cleaner:cleaners(*)')
        .eq('apartment_id', id)
        .order('date', { ascending: false })
        .limit(20),
    ]);

    if (aptRes.data) setApt(aptRes.data as any);
    if (turnoversRes.data) setTurnovers(turnoversRes.data as Turnover[]);
    setLoading(false);
  }

  async function handleUpdate(formData: FormData) {
    const supabase = createClient();
    await supabase.from('apartments').update({
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
      access_notes: formData.get('access_notes') as string || null,
      wifi_name: formData.get('wifi_name') as string || null,
      wifi_password: formData.get('wifi_password') as string || null,
      special_instructions: formData.get('special_instructions') as string || null,
    }).eq('id', params.id as string);

    setShowEdit(false);
    loadApartment();
  }

  if (loading) return <div className="p-4 lg:p-6"><div className="h-40 bg-white rounded-xl animate-pulse" /></div>;
  if (!apt) return <div className="p-4 lg:p-6 text-center text-gray-500">Appartement introuvable</div>;

  const margin = calcMargin(Number(apt.price_menage), Number(apt.cost_femme), Number(apt.cost_transport), Number(apt.cost_produits), Number(apt.cost_pressing), 0);
  const marginPct = calcMarginPct(margin, Number(apt.price_menage));

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'tarifs', label: 'Tarifs' },
    { key: 'acces', label: 'Accès' },
    { key: 'historique', label: 'Historique' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-text-primary cursor-pointer">
          <ArrowLeft size={16} /> Retour
        </button>
        <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
          <Edit size={16} /> Modifier
        </Button>
      </div>

      {/* Title Card */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text-primary">{apt.name}</h1>
            <button
              onClick={() => router.push(`/clients/${apt.client_id}`)}
              className="text-sm text-accent-dark hover:underline cursor-pointer"
            >
              {apt.client?.name}
            </button>
          </div>
          <TypeBadge type={apt.type} />
        </div>
        {apt.neighborhood && (
          <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
            <MapPin size={14} /> {apt.neighborhood}
            {apt.address && ` — ${apt.address}`}
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key ? 'bg-accent-dark text-white' : 'text-gray-500 hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'info' && (
        <Card>
          <div className="space-y-3 text-sm">
            <Row label="Type" value={apt.type} />
            <Row label="Chambres" value={String(apt.bedrooms)} />
            <Row label="Quartier" value={apt.neighborhood || '—'} />
            <Row label="Adresse" value={apt.address || '—'} />
            <Row label="Machine à laver" value={apt.has_machine_laver ? 'Oui' : 'Non'} />
            <Row label="Aspirateur" value={apt.has_aspirateur ? 'Oui' : 'Non'} />
            <Row label="Produits client" value={apt.client_provides_products ? 'Oui' : 'Non'} />
            {apt.special_instructions && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-500">Instructions:</span>
                <p className="mt-1 text-text-primary bg-gray-50 rounded-lg p-3">{apt.special_instructions}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'tarifs' && (
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Prix ménage</span>
              <span className="font-semibold text-accent-dark text-lg">{formatMAD(Number(apt.price_menage))}</span>
            </div>
            <div className="space-y-2 text-sm">
              <CostRow label="Femme de ménage" value={Number(apt.cost_femme)} />
              <CostRow label="Transport" value={Number(apt.cost_transport)} />
              <CostRow label="Produits" value={Number(apt.cost_produits)} />
              <CostRow label="Pressing" value={Number(apt.cost_pressing)} />
            </div>
            <div className="flex justify-between items-center pt-3 border-t-2 border-accent/20">
              <span className="font-semibold">Marge nette</span>
              <div className="text-right">
                <span className={`font-bold text-lg ${margin >= 0 ? 'text-status-termine' : 'text-status-annule'}`}>
                  {formatMAD(margin)}
                </span>
                <span className="text-sm text-gray-500 ml-2">({marginPct}%)</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'acces' && (
        <Card>
          <div className="space-y-4">
            {/* Door Access */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key size={16} className="text-accent-dark" />
                <span className="font-medium text-sm">Accès</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{apt.access_notes || apt.access_type || '—'}</p>
              {apt.access_code && (
                <CopyButton text={apt.access_code} label={`Code: ${apt.access_code}`} />
              )}
            </div>

            {/* WiFi */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Wifi size={16} className="text-accent-dark" />
                <span className="font-medium text-sm">WiFi</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {apt.wifi_name && <CopyButton text={apt.wifi_name} label={apt.wifi_name} />}
                {apt.wifi_password && <CopyButton text={apt.wifi_password} label={`Mdp: ${apt.wifi_password}`} />}
                {!apt.wifi_name && !apt.wifi_password && <p className="text-sm text-gray-500">Non renseigné</p>}
              </div>
            </div>

            {/* Pressing */}
            {apt.pressing_contact && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench size={16} className="text-accent-dark" />
                  <span className="font-medium text-sm">Pressing</span>
                </div>
                <CopyButton text={apt.pressing_contact} label={apt.pressing_contact} />
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'historique' && (
        <div className="space-y-2">
          {turnovers.length === 0 ? (
            <Card className="text-center py-8 text-gray-500">Aucun turnover enregistré</Card>
          ) : (
            turnovers.map(t => (
              <Card key={t.id} hover onClick={() => router.push(`/turnovers/${t.id}`)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{formatDateShort(t.date)}</span>
                    <span className="text-sm text-gray-500 ml-2">{t.cleaner?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    {t.quality_rating && (
                      <span className="text-sm text-accent-dark">{'★'.repeat(t.quality_rating)}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier appartement" size="lg">
        <form action={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input name="name" label="Nom *" defaultValue={apt.name} required />
            <Select name="type" label="Type" options={[...APARTMENT_TYPES]} defaultValue={apt.type} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="neighborhood" label="Quartier" defaultValue={apt.neighborhood || ''} />
            <Input name="address" label="Adresse" defaultValue={apt.address || ''} />
          </div>
          <Input name="bedrooms" label="Chambres" type="number" defaultValue={String(apt.bedrooms)} />
          <h3 className="font-semibold text-sm text-gray-700 pt-2">Tarifs (MAD)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input name="price_menage" label="Prix *" type="number" defaultValue={String(apt.price_menage)} required />
            <Input name="cost_femme" label="Coût femme" type="number" defaultValue={String(apt.cost_femme || '')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="cost_transport" label="Transport" type="number" defaultValue={String(apt.cost_transport || '')} />
            <Input name="cost_produits" label="Produits" type="number" defaultValue={String(apt.cost_produits || '')} />
          </div>
          <h3 className="font-semibold text-sm text-gray-700 pt-2">Accès</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select name="access_type" label="Type" options={[...ACCESS_TYPES]} placeholder="—" defaultValue={apt.access_type || ''} />
            <Input name="access_code" label="Code" defaultValue={apt.access_code || ''} />
          </div>
          <Input name="access_notes" label="Notes accès" defaultValue={apt.access_notes || ''} />
          <div className="grid grid-cols-2 gap-3">
            <Input name="wifi_name" label="WiFi nom" defaultValue={apt.wifi_name || ''} />
            <Input name="wifi_password" label="WiFi mdp" defaultValue={apt.wifi_password || ''} />
          </div>
          <Textarea name="special_instructions" label="Instructions" defaultValue={apt.special_instructions || ''} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowEdit(false)}>Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-500">– {label}</span>
      <span className="text-gray-700">{formatMAD(value || 0)}</span>
    </div>
  );
}
