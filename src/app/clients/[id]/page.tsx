'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, Building2, Edit, Trash2, Calendar } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, TypeBadge, StatusBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort } from '@/lib/utils';
import { CLIENT_TYPES, PAYMENT_METHODS, PAYMENT_FREQUENCIES } from '@/lib/constants';
import type { Client, Apartment, Turnover } from '@/lib/supabase/types';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [recentTurnovers, setRecentTurnovers] = useState<Turnover[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClient();
  }, [params.id]);

  async function loadClient() {
    const supabase = createClient();
    const id = params.id as string;

    const clientRes = await supabase.from('clients').select('*').eq('id', id).single();
    const aptsRes = await (supabase.from('apartments').select('*').eq('client_id', id).eq('is_active', true).order('name') as any);
    const turnoversRes = await (supabase.from('turnovers')
      .select('*, apartment:apartments!inner(*)')
      .eq('apartment.client_id', id)
      .order('date', { ascending: false })
      .limit(10) as any);

    if (clientRes.data) setClient(clientRes.data as any);
    if (aptsRes.data) setApartments(aptsRes.data as any);
    if (turnoversRes.data) setRecentTurnovers(turnoversRes.data as any);
    setLoading(false);
  }

  async function handleUpdate(formData: FormData) {
    const supabase = createClient();
    const { error } = await supabase
      .from('clients')
      .update({
        name: formData.get('name') as string,
        contact_name: formData.get('contact_name') as string || null,
        phone: formData.get('phone') as string || null,
        email: formData.get('email') as string || null,
        type: formData.get('type') as string,
        payment_method: formData.get('payment_method') as string,
        payment_frequency: formData.get('payment_frequency') as string,
        notes: formData.get('notes') as string || null,
      })
      .eq('id', params.id as string);

    if (!error) {
      setShowEdit(false);
      loadClient();
    }
  }

  async function handleArchive() {
    if (!confirm('Archiver ce client ?')) return;
    const supabase = createClient();
    await supabase.from('clients').update({ is_active: false }).eq('id', params.id as string);
    router.push('/clients');
  }

  if (loading) {
    return <div className="p-4 lg:p-6"><div className="h-40 bg-white rounded-xl animate-pulse" /></div>;
  }

  if (!client) {
    return <div className="p-4 lg:p-6 text-center text-gray-500">Client introuvable</div>;
  }

  const totalRevenue = recentTurnovers.reduce((sum, t) => sum + (Number(t.revenue) || 0), 0);
  const unpaidCount = recentTurnovers.filter(t => !t.is_paid_by_client).length;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-text-primary cursor-pointer">
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
            <Edit size={16} />
          </Button>
          <Button variant="danger" size="sm" onClick={handleArchive}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Client Info */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-heading text-xl font-bold text-text-primary">{client.name}</h1>
            {client.contact_name && (
              <p className="text-sm text-gray-500 mt-0.5">{client.contact_name}</p>
            )}
          </div>
          <TypeBadge type={client.type} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-accent-dark hover:underline">
              <Phone size={14} /> {client.phone}
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-gray-600 hover:underline">
              <Mail size={14} /> {client.email}
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-sm">
          <Badge variant="gold">{client.payment_method}</Badge>
          <Badge>{client.payment_frequency}</Badge>
        </div>

        {client.notes && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{client.notes}</p>
        )}
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-lg font-bold text-accent-dark">{formatMAD(totalRevenue)}</div>
          <div className="text-xs text-gray-500">Revenus récents</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-text-primary">{apartments.length}</div>
          <div className="text-xs text-gray-500">Appartements</div>
        </Card>
        <Card className="text-center">
          <div className={`text-lg font-bold ${unpaidCount > 0 ? 'text-status-en-cours' : 'text-status-termine'}`}>
            {unpaidCount}
          </div>
          <div className="text-xs text-gray-500">Non payés</div>
        </Card>
      </div>

      {/* Apartments */}
      <section>
        <CardTitle className="mb-3">
          <Building2 size={18} className="inline mr-2 text-accent-dark" />
          Appartements ({apartments.length})
        </CardTitle>
        <div className="space-y-2">
          {apartments.map(apt => (
            <Card
              key={apt.id}
              hover
              onClick={() => router.push(`/appartements/${apt.id}`)}
              className="flex items-center justify-between"
            >
              <div>
                <span className="font-medium text-text-primary">{apt.name}</span>
                <span className="text-sm text-gray-500 ml-2">{apt.neighborhood}</span>
              </div>
              <div className="flex items-center gap-2">
                <TypeBadge type={apt.type} />
                <span className="font-semibold text-accent-dark">{formatMAD(Number(apt.price_menage))}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent Turnovers */}
      {recentTurnovers.length > 0 && (
        <section>
          <CardTitle className="mb-3">
            <Calendar size={18} className="inline mr-2 text-accent-dark" />
            Derniers turnovers
          </CardTitle>
          <div className="space-y-2">
            {recentTurnovers.slice(0, 5).map(t => (
              <Card
                key={t.id}
                hover
                onClick={() => router.push(`/turnovers/${t.id}`)}
                className="flex items-center justify-between"
              >
                <div>
                  <span className="font-medium">{(t as any).apartment?.name}</span>
                  <span className="text-sm text-gray-500 ml-2">{formatDateShort(t.date)}</span>
                </div>
                <StatusBadge status={t.status} />
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier client">
        <form action={handleUpdate} className="space-y-4">
          <Input name="name" label="Nom *" defaultValue={client.name} required />
          <Input name="contact_name" label="Contact" defaultValue={client.contact_name || ''} />
          <div className="grid grid-cols-2 gap-3">
            <Input name="phone" label="Téléphone" defaultValue={client.phone || ''} type="tel" />
            <Input name="email" label="Email" defaultValue={client.email || ''} type="email" />
          </div>
          <Select name="type" label="Type" options={[...CLIENT_TYPES]} defaultValue={client.type} />
          <div className="grid grid-cols-2 gap-3">
            <Select name="payment_method" label="Paiement" options={[...PAYMENT_METHODS]} defaultValue={client.payment_method} />
            <Select name="payment_frequency" label="Fréquence" options={[...PAYMENT_FREQUENCIES]} defaultValue={client.payment_frequency} />
          </div>
          <Textarea name="notes" label="Notes" defaultValue={client.notes || ''} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowEdit(false)}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
