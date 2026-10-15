'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { formatDay, formatTime, formatMAD } from '@/lib/utils';
import type { Turnover } from '@/lib/supabase/types';

export default function Dashboard() {
  const router = useRouter();
  const [todayTurnovers, setTodayTurnovers] = useState<Turnover[]>([]);
  const [weekStats, setWeekStats] = useState({ count: 0, revenue: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // Today's turnovers
    const { data: turnovers } = await supabase
      .from('turnovers')
      .select('*, apartment:apartments(*, client:clients(*)), cleaner:cleaners(*)')
      .eq('date', today)
      .order('time_start');

    setTodayTurnovers((turnovers as Turnover[]) || []);

    // Week stats
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const { data: weekTurnovers } = await supabase
      .from('turnovers')
      .select('revenue, is_paid_by_client, status')
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0])
      .neq('status', 'annule');

    if (weekTurnovers) {
      setWeekStats({
        count: weekTurnovers.length,
        revenue: weekTurnovers.reduce((sum, t) => sum + (Number(t.revenue) || 0), 0),
        pending: weekTurnovers.filter(t => !t.is_paid_by_client).length,
      });
    }

    setLoading(false);
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold text-text-primary">
            {formatDay(new Date())}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {todayTurnovers.length} turnover{todayTurnovers.length !== 1 ? 's' : ''} prévu{todayTurnovers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => router.push('/turnovers/nouveau')}>
          <Plus size={18} />
          <span className="hidden sm:inline">Nouveau</span>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-dark">{weekStats.count}</div>
          <div className="text-xs text-gray-500 mt-1">Cette semaine</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-text-primary">{formatMAD(weekStats.revenue)}</div>
          <div className="text-xs text-gray-500 mt-1">Revenus</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-status-en-cours">{weekStats.pending}</div>
          <div className="text-xs text-gray-500 mt-1">Non payés</div>
        </Card>
      </div>

      {/* Today's Turnovers */}
      <section>
        <CardHeader>
          <CardTitle>
            <Calendar size={20} className="inline mr-2 text-accent-dark" />
            Turnovers du jour
          </CardTitle>
        </CardHeader>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : todayTurnovers.length === 0 ? (
          <Card className="text-center py-8">
            <CheckCircle size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Aucun turnover prévu aujourd&apos;hui</p>
            <Button variant="secondary" className="mt-3" onClick={() => router.push('/turnovers/nouveau')}>
              <Plus size={16} /> Planifier un turnover
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayTurnovers.map(turnover => (
              <Card
                key={turnover.id}
                hover
                onClick={() => router.push(`/turnovers/${turnover.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-text-primary">
                        {turnover.apartment?.name || 'Appartement'}
                      </span>
                      <StatusBadge status={turnover.status} />
                    </div>
                    <p className="text-sm text-gray-500">
                      {turnover.apartment?.client?.name || 'Client'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatTime(turnover.time_start)}
                      </span>
                      {turnover.cleaner && (
                        <span>{turnover.cleaner.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-accent-dark">
                      {formatMAD(Number(turnover.revenue))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Alerts */}
      {weekStats.pending > 0 && (
        <section>
          <Card className="border-l-4 border-l-status-en-cours bg-orange-50/50">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-status-en-cours mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-text-primary">
                  {weekStats.pending} paiement{weekStats.pending > 1 ? 's' : ''} en attente
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Turnovers non payés cette semaine
                </p>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Quick Actions */}
      <section className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          className="h-14 text-sm"
          onClick={() => router.push('/turnovers')}
        >
          <Calendar size={18} />
          Voir calendrier
        </Button>
        <Button
          variant="secondary"
          className="h-14 text-sm"
          onClick={() => router.push('/turnovers/nouveau')}
        >
          <Plus size={18} />
          Nouveau turnover
        </Button>
      </section>
    </div>
  );
}
