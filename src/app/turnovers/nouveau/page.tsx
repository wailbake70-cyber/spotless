'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/client';
import { formatMAD } from '@/lib/utils';
import type { Apartment, Client, Cleaner } from '@/lib/supabase/types';

type ApartmentWithClient = Apartment & { client?: Client };

export default function NewTurnoverPage() {
  return (
    <Suspense fallback={
      <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">
        <div className="h-10 bg-white rounded-xl animate-pulse" />
        <div className="h-32 bg-white rounded-xl animate-pulse" />
        <div className="h-32 bg-white rounded-xl animate-pulse" />
        <div className="h-24 bg-white rounded-xl animate-pulse" />
      </div>
    }>
      <NewTurnoverForm />
    </Suspense>
  );
}

function NewTurnoverForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apartments, setApartments] = useState<ApartmentWithClient[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [selectedAptId, setSelectedAptId] = useState(searchParams.get('apt') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill values from selected apartment
  const selectedApt = apartments.find(a => a.id === selectedAptId);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = createClient();
      const [aptsRes, cleanersRes] = await Promise.all([
        supabase.from('apartments')
          .select('*, client:clients(*)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('cleaners')
          .select('*')
          .eq('is_active', true)
          .order('name'),
      ]);
      if (aptsRes.error) throw aptsRes.error;
      if (aptsRes.data) setApartments(aptsRes.data as ApartmentWithClient[]);
      if (cleanersRes.data) setCleaners(cleanersRes.data);
    } catch (e: any) {
      setError(e?.message || 'Erreur de connexion à la base de données');
    } finally {
      setLoading(false);
    }
  }

  // Group apartments by client for the select
  const aptOptions = (() => {
    const grouped: Record<string, ApartmentWithClient[]> = {};
    for (const apt of apartments) {
      const key = apt.client?.name || 'Sans client';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(apt);
    }
    const options: { value: string; label: string }[] = [];
    for (const [clientName, apts] of Object.entries(grouped)) {
      for (const apt of apts) {
        options.push({
          value: apt.id,
          label: `${apt.name} (${clientName})`,
        });
      }
    }
    return options;
  })();

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    const supabase = createClient();

    const apartmentId = formData.get('apartment_id') as string;
    const cleanerId = formData.get('cleaner_id') as string;

    const { data, error } = await supabase.from('turnovers').insert({
      apartment_id: apartmentId,
      cleaner_id: cleanerId || null,
      date: formData.get('date') as string,
      time_start: formData.get('time_start') as string || null,
      guest_checkout: formData.get('guest_checkout') as string || null,
      guest_checkin: formData.get('guest_checkin') as string || null,
      checkin_time: formData.get('checkin_time') as string || null,
      status: cleanerId ? 'assigne' : 'planifie',
      revenue: parseFloat(formData.get('revenue') as string) || null,
      cost_femme: parseFloat(formData.get('cost_femme') as string) || null,
      notes: formData.get('notes') as string || null,
      source: 'manual',
    }).select('id').single();

    if (!error && data) {
      router.push(`/turnovers/${data.id}`);
    } else {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-text-primary cursor-pointer">
          <ArrowLeft size={16} /> Retour
        </button>
        <h1 className="font-heading text-lg font-bold">Nouveau turnover</h1>
        <div className="w-16" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle size={48} />}
          title="Erreur de connexion"
          description={error}
          action={<Button onClick={() => { setError(''); setLoading(true); loadData(); }}>Réessayer</Button>}
        />
      ) : (
        <form action={handleSubmit} className="space-y-4">
          {/* Apartment Selection */}
          <Card>
            <CardTitle className="mb-3">Appartement</CardTitle>
            <Select
              name="apartment_id"
              label="Appartement *"
              placeholder="Sélectionner un appartement..."
              options={aptOptions}
              defaultValue={selectedAptId}
              required
              onChange={(e) => setSelectedAptId(e.target.value)}
            />
            {selectedApt && (
              <div className="mt-3 p-3 bg-accent-bg rounded-lg border border-accent/10 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium">{selectedApt.client?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">{selectedApt.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quartier</span>
                  <span className="font-medium">{selectedApt.neighborhood || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Prix ménage</span>
                  <span className="font-semibold text-accent-dark">{formatMAD(Number(selectedApt.price_menage))}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Schedule */}
          <Card>
            <CardTitle className="mb-3">Planification</CardTitle>
            <div className="space-y-3">
              <Input
                name="date"
                label="Date *"
                type="date"
                defaultValue={today}
                required
              />
              <Input
                name="time_start"
                label="Heure début"
                type="time"
                placeholder="10:00"
              />
              <Select
                name="cleaner_id"
                label="Femme de ménage"
                placeholder="Non assignée"
                options={cleaners.map(c => ({ value: c.id, label: `${c.name}${c.neighborhood ? ` (${c.neighborhood})` : ''}` }))}
              />
            </div>
          </Card>

          {/* Guest Info */}
          <Card>
            <CardTitle className="mb-3">Voyageurs</CardTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input name="guest_checkout" label="Check-out" type="date" />
                <Input name="guest_checkin" label="Check-in" type="date" />
              </div>
              <Input name="checkin_time" label="Heure check-in" type="time" />
            </div>
          </Card>

          {/* Financial — auto-filled from apartment */}
          <Card>
            <CardTitle className="mb-3">Coût (MAD)</CardTitle>
            <div className="space-y-3">
              <input type="hidden" name="revenue" value={selectedApt ? String(selectedApt.price_menage) : '0'} />
              <Input
                name="cost_femme"
                label="Coût femme de ménage *"
                type="number"
                key={`femme-${selectedAptId}`}
                defaultValue={selectedApt?.cost_femme ? String(selectedApt.cost_femme) : ''}
                placeholder="90"
                required
              />
              {selectedApt && (
                <div className="p-3 bg-accent-bg rounded-lg border border-accent/10 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prix ménage (client)</span>
                    <span className="font-semibold text-accent-dark">{formatMAD(Number(selectedApt.price_menage))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Coût femme</span>
                    <span className="text-gray-700">{formatMAD(Number(selectedApt.cost_femme || 0))}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-accent/10">
                    <span className="font-semibold">Marge</span>
                    <span className={`font-bold ${(Number(selectedApt.price_menage) - Number(selectedApt.cost_femme || 0)) >= 0 ? 'text-status-termine' : 'text-status-annule'}`}>
                      {formatMAD(Number(selectedApt.price_menage) - Number(selectedApt.cost_femme || 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <Textarea name="notes" label="Notes" placeholder="Notes sur ce turnover..." />
          </Card>

          {/* Submit */}
          <div className="flex gap-3 pb-24 lg:pb-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              <Plus size={16} />
              {submitting ? 'Création...' : 'Créer le turnover'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
