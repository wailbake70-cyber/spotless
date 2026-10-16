'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit, Clock, MapPin, Key, Wifi, Phone,
  Star, AlertTriangle, DollarSign, CheckCircle, XCircle,
  User, Calendar, Wrench, ChevronRight, Trash2
} from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge, TypeBadge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatTime, formatMAD, formatDay, calcMargin, calcMarginPct, cn } from '@/lib/utils';
import { TURNOVER_STATUSES, STATUS_TRANSITIONS, type TurnoverStatus } from '@/lib/constants';
import type { Turnover, Apartment, Cleaner } from '@/lib/supabase/types';

type Tab = 'details' | 'acces' | 'qualite' | 'financier';

export default function TurnoverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [turnover, setTurnover] = useState<Turnover | null>(null);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [tab, setTab] = useState<Tab>('details');
  const [showEdit, setShowEdit] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTurnover();
  }, [params.id]);

  async function loadTurnover() {
    const supabase = createClient();
    const id = params.id as string;

    const [turnoverRes, cleanersRes] = await Promise.all([
      supabase.from('turnovers')
        .select('*, apartment:apartments(*, client:clients(*)), cleaner:cleaners(*)')
        .eq('id', id)
        .single(),
      supabase.from('cleaners').select('*').eq('is_active', true).order('name'),
    ]);

    if (turnoverRes.data) setTurnover(turnoverRes.data as Turnover);
    if (cleanersRes.data) setCleaners(cleanersRes.data);
    setLoading(false);
  }

  async function updateStatus(newStatus: TurnoverStatus) {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status: newStatus };

    // Auto-set time_end when completing
    if (newStatus === 'termine' || newStatus === 'verifie') {
      updates.time_end = new Date().toTimeString().slice(0, 8);
    }
    // Auto-set time_start when starting
    if (newStatus === 'en_cours') {
      updates.time_start = updates.time_start || new Date().toTimeString().slice(0, 8);
    }

    await supabase.from('turnovers').update(updates).eq('id', params.id as string);
    loadTurnover();
  }

  async function cancelTurnover() {
    if (!confirm('Annuler ce turnover ?')) return;
    const supabase = createClient();
    await supabase.from('turnovers').update({ status: 'annule' }).eq('id', params.id as string);
    loadTurnover();
  }

  async function togglePayment(field: 'is_paid_by_client' | 'is_paid_to_cleaner') {
    if (!turnover) return;
    const supabase = createClient();
    const newVal = !turnover[field];
    const dateField = field === 'is_paid_by_client' ? 'client_paid_date' : 'cleaner_paid_date';
    await supabase.from('turnovers').update({
      [field]: newVal,
      [dateField]: newVal ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', params.id as string);
    loadTurnover();
  }

  async function saveAnomalies(formData: FormData) {
    const supabase = createClient();
    const text = formData.get('anomalies_text') as string;
    await supabase.from('turnovers').update({
      has_anomalies: !!text,
      anomalies_text: text || null,
    }).eq('id', params.id as string);
    setShowAnomalies(false);
    loadTurnover();
  }

  async function saveQuality(formData: FormData) {
    const supabase = createClient();
    await supabase.from('turnovers').update({
      quality_rating: parseInt(formData.get('quality_rating') as string) || null,
      quality_notes: formData.get('quality_notes') as string || null,
    }).eq('id', params.id as string);
    setShowQuality(false);
    loadTurnover();
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('turnovers').delete().eq('id', params.id as string);
    router.push('/turnovers');
  }

  async function handleUpdate(formData: FormData) {
    const supabase = createClient();
    await supabase.from('turnovers').update({
      cleaner_id: formData.get('cleaner_id') as string || null,
      date: formData.get('date') as string,
      time_start: formData.get('time_start') as string || null,
      guest_checkout: formData.get('guest_checkout') as string || null,
      guest_checkin: formData.get('guest_checkin') as string || null,
      checkin_time: formData.get('checkin_time') as string || null,
      revenue: parseFloat(formData.get('revenue') as string) || null,
      cost_femme: parseFloat(formData.get('cost_femme') as string) || null,
      cost_transport: parseFloat(formData.get('cost_transport') as string) || null,
      cost_produits: parseFloat(formData.get('cost_produits') as string) || null,
      cost_pressing: parseFloat(formData.get('cost_pressing') as string) || null,
      cost_other: parseFloat(formData.get('cost_other') as string) || null,
      cost_other_label: formData.get('cost_other_label') as string || null,
      notes: formData.get('notes') as string || null,
    }).eq('id', params.id as string);

    setShowEdit(false);
    loadTurnover();
  }

  if (loading) return <div className="p-4 lg:p-6"><div className="h-40 bg-white rounded-xl animate-pulse" /></div>;
  if (!turnover) return <div className="p-4 lg:p-6 text-center text-gray-500">Turnover introuvable</div>;

  const apt = turnover.apartment;
  const nextStatus = STATUS_TRANSITIONS[turnover.status];
  const margin = calcMargin(
    Number(turnover.revenue), Number(turnover.cost_femme),
    Number(turnover.cost_transport), Number(turnover.cost_produits),
    Number(turnover.cost_pressing), Number(turnover.cost_other)
  );
  const marginPct = calcMarginPct(margin, Number(turnover.revenue));

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Détails' },
    { key: 'acces', label: 'Accès' },
    { key: 'qualite', label: 'Qualité' },
    { key: 'financier', label: 'Financier' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-text-primary cursor-pointer">
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 size={16} className="text-status-annule" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
            <Edit size={16} /> Modifier
          </Button>
        </div>
      </div>

      {/* Title Card */}
      <Card>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="font-heading text-xl font-bold text-text-primary">
              {apt?.name || 'Turnover'}
            </h1>
            {apt?.client && (
              <button
                onClick={() => router.push(`/clients/${apt.client_id}`)}
                className="text-sm text-accent-dark hover:underline cursor-pointer"
              >
                {apt.client.name}
              </button>
            )}
          </div>
          <StatusBadge status={turnover.status} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Calendar size={14} className="text-accent-dark" />
            {formatDate(turnover.date)}
          </span>
          {turnover.time_start && (
            <span className="flex items-center gap-1">
              <Clock size={14} /> {formatTime(turnover.time_start)}
              {turnover.time_end && ` – ${formatTime(turnover.time_end)}`}
            </span>
          )}
          {turnover.cleaner && (
            <span className="flex items-center gap-1">
              <User size={14} /> {turnover.cleaner.name}
            </span>
          )}
        </div>

        {/* Guest times */}
        {(turnover.guest_checkout || turnover.guest_checkin) && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
            {turnover.guest_checkout && (
              <span className="text-gray-500">
                Check-out: <span className="text-text-primary font-medium">{turnover.guest_checkout}</span>
              </span>
            )}
            {turnover.guest_checkin && (
              <span className="text-gray-500">
                Check-in: <span className="text-text-primary font-medium">{turnover.guest_checkin}</span>
                {turnover.checkin_time && ` à ${formatTime(turnover.checkin_time)}`}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer',
              tab === t.key ? 'bg-accent-dark text-white' : 'text-gray-500 hover:text-text-primary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {tab === 'details' && (
        <Card>
          <div className="space-y-3 text-sm">
            <Row label="Appartement" value={apt?.name || '—'} />
            <Row label="Type" value={apt?.type || '—'} />
            <Row label="Client" value={apt?.client?.name || '—'} />
            <Row label="Femme de ménage" value={turnover.cleaner?.name || 'Non assignée'} />
            <Row label="Date" value={formatDate(turnover.date)} />
            <Row label="Heure début" value={formatTime(turnover.time_start)} />
            <Row label="Heure fin" value={formatTime(turnover.time_end)} />
            <Row label="Source" value={turnover.source === 'manual' ? 'Manuelle' : 'N8N'} />
            {turnover.notes && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-500">Notes:</span>
                <p className="mt-1 text-text-primary bg-gray-50 rounded-lg p-3">{turnover.notes}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Access Tab */}
      {tab === 'acces' && apt && (
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

            {/* Special Instructions */}
            {apt.special_instructions && (
              <div className="pt-3 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Instructions spéciales</span>
                <p className="mt-1 text-sm text-text-primary bg-accent-bg rounded-lg p-3 border border-accent/10">
                  {apt.special_instructions}
                </p>
              </div>
            )}

            {/* Equipment */}
            <div className="pt-3 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-700 mb-2 block">Équipement</span>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={apt.has_machine_laver ? 'success' : 'default'}>
                  Machine à laver: {apt.has_machine_laver ? 'Oui' : 'Non'}
                </Badge>
                <Badge variant={apt.has_aspirateur ? 'success' : 'default'}>
                  Aspirateur: {apt.has_aspirateur ? 'Oui' : 'Non'}
                </Badge>
                <Badge variant={apt.client_provides_products ? 'gold' : 'default'}>
                  Produits client: {apt.client_provides_products ? 'Oui' : 'Non'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quality Tab */}
      {tab === 'qualite' && (
        <div className="space-y-3">
          {/* Rating */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Note qualité</span>
                <div className="mt-1">
                  {turnover.quality_rating ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          size={20}
                          className={s <= turnover.quality_rating! ? 'text-accent-dark fill-accent-dark' : 'text-gray-200'}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Non noté</span>
                  )}
                </div>
                {turnover.quality_notes && (
                  <p className="mt-2 text-sm text-gray-600">{turnover.quality_notes}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowQuality(true)}>
                <Edit size={14} /> Noter
              </Button>
            </div>
          </Card>

          {/* Anomalies */}
          <Card className={turnover.has_anomalies ? 'border-l-4 border-l-status-annule' : ''}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className={turnover.has_anomalies ? 'text-status-annule' : 'text-gray-300'} />
                  <span className="text-sm font-medium text-gray-700">Anomalies</span>
                </div>
                {turnover.has_anomalies ? (
                  <p className="mt-1 text-sm text-gray-600">{turnover.anomalies_text}</p>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">Aucune anomalie signalée</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAnomalies(true)}>
                <Edit size={14} /> Signaler
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Financial Tab */}
      {tab === 'financier' && (
        <div className="space-y-3">
          {/* Revenue & Costs */}
          <Card>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Revenu</span>
                <span className="font-semibold text-accent-dark text-lg">{formatMAD(Number(turnover.revenue))}</span>
              </div>
              <div className="space-y-2 text-sm">
                <CostRow label="Femme de ménage" value={Number(turnover.cost_femme)} />
                <CostRow label="Transport" value={Number(turnover.cost_transport)} />
                <CostRow label="Produits" value={Number(turnover.cost_produits)} />
                <CostRow label="Pressing" value={Number(turnover.cost_pressing)} />
                {Number(turnover.cost_other) > 0 && (
                  <CostRow label={turnover.cost_other_label || 'Autre'} value={Number(turnover.cost_other)} />
                )}
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

          {/* Payment Status */}
          <Card>
            <CardTitle className="mb-3">
              <DollarSign size={16} className="inline mr-1 text-accent-dark" />
              Paiements
            </CardTitle>
            <div className="space-y-3">
              <PaymentToggle
                label="Client a payé"
                paid={turnover.is_paid_by_client}
                date={turnover.client_paid_date}
                onToggle={() => togglePayment('is_paid_by_client')}
              />
              <PaymentToggle
                label="Femme de ménage payée"
                paid={turnover.is_paid_to_cleaner}
                date={turnover.cleaner_paid_date}
                onToggle={() => togglePayment('is_paid_to_cleaner')}
              />
              {turnover.cleaner_got_prime && (
                <div className="flex items-center gap-2 text-sm text-accent-dark">
                  <Star size={14} className="fill-accent-dark" />
                  Prime qualité accordée
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Status Action Bar */}
      {turnover.status !== 'annule' && turnover.status !== 'verifie' && turnover.status !== 'termine' && (
        <div className="fixed bottom-20 lg:bottom-6 left-0 right-0 lg:left-60 px-4 lg:px-6">
          <div className="max-w-5xl mx-auto flex gap-3">
            <Button
              className="flex-1 h-12 text-base"
              onClick={() => updateStatus('verifie')}
            >
              <CheckCircle size={20} />
              Fait ✓
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="h-12 px-4"
              onClick={cancelTurnover}
            >
              <XCircle size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* Quality Modal */}
      <Modal isOpen={showQuality} onClose={() => setShowQuality(false)} title="Noter la qualité">
        <form action={saveQuality} className="space-y-4">
          <Select
            name="quality_rating"
            label="Note (1-5)"
            options={[
              { value: '1', label: '1 — Très mauvais' },
              { value: '2', label: '2 — Mauvais' },
              { value: '3', label: '3 — Moyen' },
              { value: '4', label: '4 — Bien' },
              { value: '5', label: '5 — Excellent' },
            ]}
            defaultValue={String(turnover.quality_rating || '')}
            placeholder="Sélectionner..."
          />
          <Textarea
            name="quality_notes"
            label="Commentaires"
            defaultValue={turnover.quality_notes || ''}
            placeholder="Observations sur la qualité..."
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowQuality(false)}>Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* Anomalies Modal */}
      <Modal isOpen={showAnomalies} onClose={() => setShowAnomalies(false)} title="Signaler une anomalie">
        <form action={saveAnomalies} className="space-y-4">
          <Textarea
            name="anomalies_text"
            label="Description"
            defaultValue={turnover.anomalies_text || ''}
            placeholder="Décrivez le problème constaté..."
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAnomalies(false)}>Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Supprimer cette mission ?">
        <p className="text-sm text-gray-600 mb-4">
          Cette action est irréversible. La mission du <strong>{formatDate(turnover.date)}</strong> pour <strong>{apt?.name}</strong> sera supprimée.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowDelete(false)}>Annuler</Button>
          <Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier turnover" size="lg">
        <form action={handleUpdate} className="space-y-4">
          <Select
            name="cleaner_id"
            label="Femme de ménage"
            options={cleaners.map(c => ({ value: c.id, label: c.name }))}
            defaultValue={turnover.cleaner_id || ''}
            placeholder="Non assignée"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input name="date" label="Date *" type="date" defaultValue={turnover.date} required />
            <Input name="time_start" label="Heure début" type="time" defaultValue={turnover.time_start || ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="guest_checkout" label="Check-out" type="date" defaultValue={turnover.guest_checkout || ''} />
            <Input name="guest_checkin" label="Check-in" type="date" defaultValue={turnover.guest_checkin || ''} />
          </div>
          <Input name="checkin_time" label="Heure check-in" type="time" defaultValue={turnover.checkin_time || ''} />

          <h3 className="font-semibold text-sm text-gray-700 pt-2">Financier (MAD)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input name="revenue" label="Revenu" type="number" defaultValue={String(turnover.revenue || '')} />
            <Input name="cost_femme" label="Coût femme" type="number" defaultValue={String(turnover.cost_femme || '')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="cost_transport" label="Transport" type="number" defaultValue={String(turnover.cost_transport || '')} />
            <Input name="cost_produits" label="Produits" type="number" defaultValue={String(turnover.cost_produits || '')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="cost_pressing" label="Pressing" type="number" defaultValue={String(turnover.cost_pressing || '')} />
            <Input name="cost_other" label="Autre coût" type="number" defaultValue={String(turnover.cost_other || '')} />
          </div>
          <Input name="cost_other_label" label="Libellé autre" defaultValue={turnover.cost_other_label || ''} />
          <Textarea name="notes" label="Notes" defaultValue={turnover.notes || ''} />

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

function PaymentToggle({
  label, paid, date, onToggle
}: {
  label: string;
  paid: boolean;
  date: string | null;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center justify-between w-full py-2.5 px-3 rounded-lg text-sm transition-colors cursor-pointer',
        paid ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
      )}
    >
      <div className="flex items-center gap-2">
        {paid ? (
          <CheckCircle size={18} className="text-status-termine" />
        ) : (
          <XCircle size={18} className="text-gray-300" />
        )}
        <span className={paid ? 'text-status-termine font-medium' : 'text-gray-600'}>{label}</span>
      </div>
      {paid && date && (
        <span className="text-xs text-gray-500">{date}</span>
      )}
    </button>
  );
}
