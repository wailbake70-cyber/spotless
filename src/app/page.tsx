'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, AlertTriangle, TrendingUp, Clock, CheckCircle, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { formatDay, formatTime, formatMAD } from '@/lib/utils';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  startOfWeek, subWeeks, endOfWeek, startOfMonth, endOfMonth, subMonths, format
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Turnover } from '@/lib/supabase/types';

type ChartPeriod = '1m' | '3m' | '6m' | 'tout';
const CHART_PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: '1m', label: '1 mois' },
  { key: '3m', label: '3 mois' },
  { key: '6m', label: '6 mois' },
  { key: 'tout', label: 'Tout' },
];

export default function Dashboard() {
  const router = useRouter();
  const [todayTurnovers, setTodayTurnovers] = useState<Turnover[]>([]);
  const [weekStats, setWeekStats] = useState({ count: 0, revenue: 0, costFemme: 0, margin: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [showRevenue, setShowRevenue] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [showMargin, setShowMargin] = useState(false);
  const [chartData, setChartData] = useState<{ label: string; revenue: number; margin: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('3m');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadChart();
  }, [chartPeriod]);

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
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data: weekTurnovers } = await supabase
      .from('turnovers')
      .select('revenue, cost_femme, is_paid_by_client, status')
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0])
      .neq('status', 'annule');

    if (weekTurnovers) {
      const revenue = weekTurnovers.reduce((sum, t) => sum + (Number(t.revenue) || 0), 0);
      const costFemme = weekTurnovers.reduce((sum, t) => sum + (Number(t.cost_femme) || 0), 0);
      setWeekStats({
        count: weekTurnovers.length,
        revenue,
        costFemme,
        margin: revenue - costFemme,
        pending: weekTurnovers.filter(t => !t.is_paid_by_client).length,
      });
    }

    setLoading(false);
  }

  async function loadChart() {
    const supabase = createClient();
    const now = new Date();

    interface Bucket { label: string; start: string; end: string }
    const buckets: Bucket[] = [];

    if (chartPeriod === '1m') {
      // 4 weeks
      for (let i = 3; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        buckets.push({ label: format(ws, 'd MMM', { locale: fr }), start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd') });
      }
    } else if (chartPeriod === '3m') {
      // 12 weeks
      for (let i = 11; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        buckets.push({ label: format(ws, 'd MMM', { locale: fr }), start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd') });
      }
    } else if (chartPeriod === '6m') {
      // 6 months
      for (let i = 5; i >= 0; i--) {
        const ms = startOfMonth(subMonths(now, i));
        const me = endOfMonth(ms);
        buckets.push({ label: format(ms, 'MMM yy', { locale: fr }), start: format(ms, 'yyyy-MM-dd'), end: format(me, 'yyyy-MM-dd') });
      }
    } else {
      // tout — 12 months
      for (let i = 11; i >= 0; i--) {
        const ms = startOfMonth(subMonths(now, i));
        const me = endOfMonth(ms);
        buckets.push({ label: format(ms, 'MMM yy', { locale: fr }), start: format(ms, 'yyyy-MM-dd'), end: format(me, 'yyyy-MM-dd') });
      }
    }

    let query = supabase
      .from('turnovers')
      .select('date, revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other')
      .gte('date', buckets[0].start)
      .lte('date', buckets[buckets.length - 1].end)
      .neq('status', 'annule');

    const { data: allData } = await query;

    const chart = buckets.map(b => {
      const bTurnovers = (allData || []).filter(
        (t: { date: string }) => t.date >= b.start && t.date <= b.end
      );
      const rev = bTurnovers.reduce((s: number, t: { revenue: number | null }) => s + (Number(t.revenue) || 0), 0);
      const cost = bTurnovers.reduce((s: number, t: { cost_femme: number | null; cost_transport: number | null; cost_produits: number | null; cost_pressing: number | null; cost_other: number | null }) =>
        s + (Number(t.cost_femme) || 0) + (Number(t.cost_transport) || 0) + (Number(t.cost_produits) || 0) + (Number(t.cost_pressing) || 0) + (Number(t.cost_other) || 0), 0);
      return { label: b.label, revenue: rev, margin: rev - cost };
    });
    setChartData(chart);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-dark">{weekStats.count}</div>
          <div className="text-xs text-gray-500 mt-1">Cette semaine</div>
        </Card>
        <Card className="text-center cursor-pointer" onClick={() => setShowRevenue(!showRevenue)}>
          <div className="flex items-center justify-center gap-2">
            <div className="text-2xl font-bold text-text-primary">
              {showRevenue ? formatMAD(weekStats.revenue) : '•••••'}
            </div>
            {showRevenue ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
          </div>
          <div className="text-xs text-gray-500 mt-1">Revenus clients</div>
        </Card>
        <Card className="text-center cursor-pointer" onClick={() => setShowCost(!showCost)}>
          <div className="flex items-center justify-center gap-2">
            <div className="text-2xl font-bold text-status-annule">
              {showCost ? formatMAD(weekStats.costFemme) : '•••••'}
            </div>
            {showCost ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
          </div>
          <div className="text-xs text-gray-500 mt-1">Coût femmes</div>
        </Card>
        <Card className="text-center cursor-pointer" onClick={() => setShowMargin(!showMargin)}>
          <div className="flex items-center justify-center gap-2">
            <div className={`text-2xl font-bold ${weekStats.margin >= 0 ? 'text-status-termine' : 'text-status-annule'}`}>
              {showMargin ? formatMAD(weekStats.margin) : '•••••'}
            </div>
            {showMargin ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
          </div>
          <div className="text-xs text-gray-500 mt-1">Ma marge</div>
        </Card>
      </div>
      {weekStats.pending > 0 && (
        <Card className="text-center cursor-pointer" hover onClick={() => router.push('/finances')}>
          <div className="text-xl font-bold text-status-en-cours">{weekStats.pending}</div>
          <div className="text-xs text-gray-500 mt-1">Non payés → Voir détails</div>
        </Card>
      )}

      {/* Evolution Chart */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-lg font-bold text-text-primary flex items-center gap-2">
            <BarChart3 size={20} className="text-accent-dark" />
            Évolution
          </h2>
        </div>
        {/* Period selector */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          {CHART_PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setChartPeriod(p.key)}
              className={cn(
                'flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer',
                chartPeriod === p.key
                  ? 'bg-white text-accent-dark shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Card>
          <div className="h-52 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B7285" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0B7285" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
                  formatter={(value: unknown, name: unknown) => [
                    `${value} MAD`,
                    name === 'revenue' ? 'Revenus' : 'Marge'
                  ]}
                  labelFormatter={(label: unknown) => `${chartPeriod === '6m' || chartPeriod === 'tout' ? '' : 'Sem. '}${label}`}
                />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="#0B7285" strokeWidth={2.5} fill="url(#gradRevenu)" dot={{ r: 3, fill: '#0B7285' }} />
                <Area type="monotone" dataKey="margin" name="margin" stroke="#22c55e" strokeWidth={2} fill="url(#gradMarge)" dot={{ r: 3, fill: '#22c55e' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-5 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#0B7285] rounded-full inline-block" /> Revenus</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#22c55e] rounded-full inline-block" /> Marge</span>
          </div>
        </Card>
      </section>

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
