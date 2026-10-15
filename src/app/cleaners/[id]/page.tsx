'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, MapPin, Edit, Trash2, Calendar, Star, DollarSign } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort, cn } from '@/lib/utils';
import type { Cleaner, Turnover } from '@/lib/supabase/types';

export default function CleanerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [cleaner, setCleaner] = useState<Cleaner | null>(null);
  const [turnovers, setTurnovers] = useState<Turnover[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCleaner();
  }, [params.id]);

  async function loadCleaner() {
    const supabase = createClient();
    const id = params.id as string;

    const [cleanerRes, turnoversRes] = await Promise.all([
      supabase.from('cleaners').select('*').eq('id', id).single(),
      supabase.from('turnovers')
        .select('*, apartment:apartments(name, neighborhood)')
        .eq('cleaner_id', id)
        .order('date', { ascending: false })
        .limit(20),
    ]);

    if (cleanerRes.data) setCleaner(cleanerRes.data);
    if (turnoversRes.data) setTurnovers(turnoversRes.data as Turnover[]);
    setLoading(false);
  }

  async function handleUpdate(formData: FormData) {
    const supabase = createClient();
    await supabase.from('cleaners').update({
      name: formData.get('name') as string,
      phone: formData.get('phone') as string || null,
      neighborhood: formData.get('neighborhood') as string || null,
      base_rate_studio: parseFloat(formData.get('base_rate_studio') as string) || 80,
      base_rate_2ch: parseFloat(formData.get('base_rate_2ch') as string) || 100,
      base_rate_3ch: parseFloat(formData.get('base_rate_3ch') as string) || 120,
      prime_qualite: parseFloat(formData.get('prime_qualite') as string) || 20,
      payment_day: formData.get('payment_day') as string || 'immediat',
      notes: formData.get('notes') as string || null,
    }).eq('id', params.id as string);

    setShowEdit(false);
    loadCleaner();
  }

  async function handleArchive() {
    if (!confirm('Archiver cette collaboratrice ?')) return;
    const supabase = createClient();
    await supabase.from('cleaners').update({ is_active: false }).eq('id', params.id as string);
    router.push('/cleaners');
  }

  if (loading) return <div className="p-4 lg:p-6"><div className="h-40 bg-white rounded-xl animate-pulse" /></div>;
  if (!cleaner) return <div className="p-4 lg:p-6 text-center text-gray-500">Collaboratrice introuvable</div>;

  const totalEarned = turnovers.reduce((sum, t) => sum + (Number(t.cost_femme) || 0), 0);
  const avgRating = turnovers.filter(t => t.quality_rating).reduce((acc, t, _, arr) => acc + (t.quality_rating! / arr.length), 0);
  const completedCount = turnovers.filter(t => t.status === 'termine' || t.status === 'verifie').length;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-black cursor-pointer">
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

      {/* Info Card */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-heading text-xl font-bold text-brand-black">{cleaner.name}</h1>
            {cleaner.neighborhood && (
              <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <MapPin size={14} /> {cleaner.neighborhood}
              </p>
            )}
          </div>
          {cleaner.phone && (
            <a
              href={`tel:${cleaner.phone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gold/10 text-brand-gold-dark text-sm font-medium hover:bg-brand-gold/20 transition-colors"
            >
              <Phone size={14} /> Appeler
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="gold">{formatMAD(cleaner.base_rate_studio)} studio</Badge>
          <Badge variant="gold">{formatMAD(cleaner.base_rate_2ch)} 2ch</Badge>
          <Badge variant="gold">{formatMAD(cleaner.base_rate_3ch)} 3ch</Badge>
          <Badge>Prime: {formatMAD(cleaner.prime_qualite)}</Badge>
        </div>

        {cleaner.notes && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{cleaner.notes}</p>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-lg font-bold text-brand-gold">{completedCount}</div>
          <div className="text-xs text-gray-500">Turnovers</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-brand-black">{formatMAD(totalEarned)}</div>
          <div className="text-xs text-gray-500">Total versé</div>
        </Card>
        <Card className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Star size={14} className="text-brand-gold fill-brand-gold" />
            <span className="text-lg font-bold text-brand-black">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </span>
          </div>
          <div className="text-xs text-gray-500">Note moy.</div>
        </Card>
      </div>

      {/* Recent Turnovers */}
      {turnovers.length > 0 && (
        <section>
          <CardTitle className="mb-3">
            <Calendar size={18} className="inline mr-2 text-brand-gold" />
            Derniers turnovers
          </CardTitle>
          <div className="space-y-2">
            {turnovers.map(t => (
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  {t.quality_rating && (
                    <span className="text-sm text-brand-gold">{'★'.repeat(t.quality_rating)}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier collaboratrice">
        <form action={handleUpdate} className="space-y-4">
          <Input name="name" label="Nom *" defaultValue={cleaner.name} required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="phone" label="Téléphone" defaultValue={cleaner.phone || ''} type="tel" />
            <Input name="neighborhood" label="Quartier" defaultValue={cleaner.neighborhood || ''} />
          </div>
          <h3 className="font-semibold text-sm text-gray-700 pt-2">Tarifs (MAD)</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input name="base_rate_studio" label="Studio" type="number" defaultValue={String(cleaner.base_rate_studio)} />
            <Input name="base_rate_2ch" label="2ch" type="number" defaultValue={String(cleaner.base_rate_2ch)} />
            <Input name="base_rate_3ch" label="3ch" type="number" defaultValue={String(cleaner.base_rate_3ch)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="prime_qualite" label="Prime qualité" type="number" defaultValue={String(cleaner.prime_qualite)} />
            <Input name="payment_day" label="Jour paiement" defaultValue={cleaner.payment_day} />
          </div>
          <Textarea name="notes" label="Notes" defaultValue={cleaner.notes || ''} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowEdit(false)}>Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
