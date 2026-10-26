'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Plus, AlertTriangle, TrendingUp, TrendingDown,
  Clock, CheckCircle, Eye, EyeOff, BarChart3, ChevronRight,
  Sparkles, ArrowRight, Minus
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { formatDay, formatTime, formatMAD, cn } from '@/lib/utils';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths,
  addDays, format
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Turnover } from '@/lib/supabase/types';

type ChartPeriod = '1m' | '3m' | '6m' | 'tout';
const CHART_PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: '1m', label: '1 mois' },
  { key: '3m', label: '3 mois' },
  { key: '6m', label: '6 mois' },
  { key: 'tout', label: 'Tout' },
];

interface WeekStats {
  count: number;
  revenue: number;
  costTotal: number;
  margin: number;
  pending: number;
  pendingAmount: number;
}

interface ChartPoint {
  label: string;
  revenue: number;
  costs: number;
  margin: number;
  count: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [todayTurnovers, setTodayTurnovers] = useState<Turnover[]>([]);
  const [tomorrowTurnovers, setTomorrowTurnovers] = useState<Turnover[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStats>({ count: 0, revenue: 0, costTotal: 0, margin: 0, pending: 0, pendingAmount: 0 });
  const [lastWeekStats, setLastWeekStats] = useState<WeekStats>({ count: 0, revenue: 0, costTotal: 0, margin: 0, pending: 0, pendingAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [showFinances, setShowFinances] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('3m');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadChart();
  }, [chartPeriod]);

  function calcWeekStats(turnovers: { revenue: number | null; cost_femme: number | null; cost_transport: number | null; cost_produits: number | null; cost_pressing: number | null; cost_other: number | null; is_paid_by_client: boolean; status: string }[]): WeekStats {
    let revenue = 0, costTotal = 0, pending = 0, pendingAmount = 0;
    for (const t of turnovers) {
      revenue += Number(t.revenue) || 0;
      costTotal += (Number(t.cost_femme) || 0) + (Number(t.cost_transport) || 0) +
        (Number(t.cost_produits) || 0) + (Number(t.cost_pressing) || 0) + (Number(t.cost_other) || 0);
      if (!t.is_paid_by_client) {
        pending++;
        pendingAmount += Number(t.revenue) || 0;
      }
    }
    return { count: turnovers.length, revenue, costTotal, margin: revenue - costTotal, pending, pendingAmount };
  }

  async function loadData() {
    const supabase = createClient();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = addDays(today, 1).toISOString().split('T')[0];

    // Today's turnovers — ALL (completed and not)
    const { data: todayData } = await supabase
      .from('turnovers')
      .select('*, apartment:apartments(*, client:clients(*)), cleaner:cleaners(*)')
      .eq('date', todayStr)
      .neq('status', 'annule')
      .order('time_start');

    setTodayTurnovers((todayData as Turnover[]) || []);

    // Tomorrow's turnovers
    const { data: tomorrowData } = await supabase
      .from('turnovers')
      .select('*, apartment:apartments(*, client:clients(*)), cleaner:cleaners(*)')
      .eq('date', tomorrowStr)
      .neq('status', 'annule')
      .order('time_start');

    setTomorrowTurnovers((tomorrowData as Turnover[]) || []);

    // This week stats
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const { data: weekTurnovers } = await supabase
      .from('turnovers')
      .select('revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other, is_paid_by_client, status')
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .neq('status', 'annule');

    if (weekTurnovers) setWeekStats(calcWeekStats(weekTurnovers));

    // Last week stats (for comparison)
    const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

    const { data: lastWeekTurnovers } = await supabase
      .from('turnovers')
      .select('revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other, is_paid_by_client, status')
      .gte('date', format(lastWeekStart, 'yyyy-MM-dd'))
      .lte('date', format(lastWeekEnd, 'yyyy-MM-dd'))
      .neq('status', 'annule');

    if (lastWeekTurnovers) setLastWeekStats(calcWeekStats(lastWeekTurnovers));

    setLoading(false);
  }

  async function loadChart() {
    const supabase = createClient();
    const now = new Date();

    interface Bucket { label: string; start: string; end: string }
    const buckets: Bucket[] = [];

    if (chartPeriod === '1m') {
      for (let i = 3; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        buckets.push({ label: format(ws, 'd MMM', { locale: fr }), start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd') });
      }
    } else if (chartPeriod === '3m') {
      for (let i = 11; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        buckets.push({ label: format(ws, 'd MMM', { locale: fr }), start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd') });
      }
    } else if (chartPeriod === '6m') {
      for (let i = 5; i >= 0; i--) {
        const ms = startOfMonth(subMonths(now, i));
        const me = endOfMonth(ms);
        buckets.push({ label: format(ms, 'MMM yy', { locale: fr }), start: format(ms, 'yyyy-MM-dd'), end: format(me, 'yyyy-MM-dd') });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const ms = startOfMonth(subMonths(now, i));
        const me = endOfMonth(ms);
        buckets.push({ label: format(ms, 'MMM yy', { locale: fr }), start: format(ms, 'yyyy-MM-dd'), end: format(me, 'yyyy-MM-dd') });
      }
    }

    const { data: allData } = await supabase
      .from('turnovers')
      .select('date, revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other')
      .gte('date', buckets[0].start)
      .lte('date', buckets[buckets.length - 1].end)
      .neq('status', 'annule');

    const chart = buckets.map(b => {
      const bTurnovers = (allData || []).filter(
        (t: { date: string }) => t.date >= b.start && t.date <= b.end
      );
      const rev = bTurnovers.reduce((s: number, t: { revenue: number | null }) => s + (Number(t.revenue) || 0), 0);
      const cost = bTurnovers.reduce((s: number, t: { cost_femme: number | null; cost_transport: number | null; cost_produits: number | null; cost_pressing: number | null; cost_other: number | null }) =>
        s + (Number(t.cost_femme) || 0) + (Number(t.cost_transport) || 0) + (Number(t.cost_produits) || 0) + (Number(t.cost_pressing) || 0) + (Number(t.cost_other) || 0), 0);
      return { label: b.label, revenue: rev, costs: cost, margin: rev - cost, count: bTurnovers.length };
    });
    setChartData(chart);
  }

  // Today: separate done vs to-do
  const todayDone = todayTurnovers.filter(t => t.status === 'termine' || t.status === 'verifie');
  const todayTodo = todayTurnovers.filter(t => t.status !== 'termine' && t.status !== 'verifie');

  // Trend helpers
  function trendIcon(current: number, previous: number) {
    if (previous === 0 && current === 0) return null;
    if (current > previous) return <TrendingUp size={14} className="text-emerald-500" />;
    if (current < previous) return <TrendingDown size={14} className="text-red-500" />;
    return <Minus size={14} className="text-gray-400" />;
  }

  function trendText(current: number, previous: number) {
    if (previous === 0) return current > 0 ? '+100%' : '—';
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return '=';
    return `${pct > 0 ? '+' : ''}${pct}%`;
  }

  // Chart period totals for summary
  const chartTotals = useMemo(() => {
    const rev = chartData.reduce((s, d) => s + d.revenue, 0);
    const cost = chartData.reduce((s, d) => s + d.costs, 0);
    const count = chartData.reduce((s, d) => s + d.count, 0);
    return { revenue: rev, costs: cost, margin: rev - cost, count };
  }, [chartData]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto pb-28 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold text-text-primary">
            {formatDay(new Date())}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {todayTurnovers.length > 0
              ? `${todayTurnovers.length} turnover${todayTurnovers.length > 1 ? 's' : ''} — ${todayTodo.length} à faire, ${todayDone.length} fait${todayDone.length > 1 ? 's' : ''}`
              : 'Aucun turnover prévu'
            }
          </p>
        </div>
        <Button onClick={() => router.push('/turnovers/nouveau')}>
          <Plus size={18} />
          <span className="hidden sm:inline">Nouveau</span>
        </Button>
      </div>

      {/* Weekly Stats with Trends */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-2xl font-bold text-accent-dark">{weekStats.count}</span>
            {trendIcon(weekStats.count, lastWeekStats.count)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Cette semaine</div>
          {lastWeekStats.count > 0 && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              vs {lastWeekStats.count} sem. dernière
            </div>
          )}
        </Card>

        <Card className="text-center cursor-pointer" onClick={() => setShowFinances(!showFinances)}>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-2xl font-bold text-text-primary">
              {showFinances ? formatMAD(weekStats.revenue) : '•••••'}
            </span>
            {showFinances ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
          </div>
          <div className="text-xs text-gray-500 mt-1">Revenus</div>
          {showFinances && lastWeekStats.revenue > 0 && (
            <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
              {trendIcon(weekStats.revenue, lastWeekStats.revenue)}
              <span className={weekStats.revenue >= lastWeekStats.revenue ? 'text-emerald-600' : 'text-red-500'}>
                {trendText(weekStats.revenue, lastWeekStats.revenue)}
              </span>
            </div>
          )}
        </Card>

        <Card className="text-center cursor-pointer" onClick={() => setShowFinances(!showFinances)}>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-2xl font-bold text-status-annule">
              {showFinances ? formatMAD(weekStats.costTotal) : '•••••'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Coûts totaux</div>
          {showFinances && lastWeekStats.costTotal > 0 && (
            <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
              {trendIcon(weekStats.costTotal, lastWeekStats.costTotal)}
              <span className={weekStats.costTotal <= lastWeekStats.costTotal ? 'text-emerald-600' : 'text-red-500'}>
                {trendText(weekStats.costTotal, lastWeekStats.costTotal)}
              </span>
            </div>
          )}
        </Card>

        <Card className="text-center cursor-pointer" onClick={() => setShowFinances(!showFinances)}>
          <div className="flex items-center justify-center gap-1.5">
            <span className={`text-2xl font-bold ${weekStats.margin >= 0 ? 'text-status-termine' : 'text-status-annule'}`}>
              {showFinances ? formatMAD(weekStats.margin) : '•••••'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Ma marge</div>
          {showFinances && weekStats.revenue > 0 && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              {Math.round((weekStats.margin / weekStats.revenue) * 100)}% de marge
            </div>
          )}
        </Card>
      </div>

      {/* Pending payments alert */}
      {weekStats.pending > 0 && (
        <Card
          hover
          className="border-l-4 border-l-status-en-cours bg-orange-50/50 cursor-pointer"
          onClick={() => router.push('/finances')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-status-en-cours mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-text-primary">
                  {weekStats.pending} paiement{weekStats.pending > 1 ? 's' : ''} en attente
                </p>
                {showFinances && (
                  <p className="text-sm text-orange-700 font-semibold mt-0.5">
                    {formatMAD(weekStats.pendingAmount)} à encaisser
                  </p>
                )}
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </Card>
      )}

      {/* Today's Turnovers — ALL */}
      <section>
        <CardHeader>
          <CardTitle>
            <Calendar size={20} className="inline mr-2 text-accent-dark" />
            Aujourd&apos;hui
            {todayTurnovers.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({todayTurnovers.length})
              </span>
            )}
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
          <div className="space-y-2">
            {/* À faire first */}
            {todayTodo.length > 0 && (
              <>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider px-1">
                  À faire ({todayTodo.length})
                </p>
                {todayTodo.map(turnover => (
                  <TurnoverCard key={turnover.id} turnover={turnover} onClick={() => router.push(`/turnovers/${turnover.id}`)} showRevenue={showFinances} />
                ))}
              </>
            )}
            {/* Done */}
            {todayDone.length > 0 && (
              <>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider px-1 mt-3">
                  Fait ({todayDone.length})
                </p>
                {todayDone.map(turnover => (
                  <TurnoverCard key={turnover.id} turnover={turnover} onClick={() => router.push(`/turnovers/${turnover.id}`)} showRevenue={showFinances} done />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* Tomorrow's Turnovers */}
      {!loading && tomorrowTurnovers.length > 0 && (
        <section>
          <CardHeader>
            <CardTitle>
              <ArrowRight size={20} className="inline mr-2 text-accent-dark" />
              Demain
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({tomorrowTurnovers.length})
              </span>
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {tomorrowTurnovers.map(turnover => (
              <TurnoverCard key={turnover.id} turnover={turnover} onClick={() => router.push(`/turnovers/${turnover.id}`)} showRevenue={showFinances} />
            ))}
          </div>
        </section>
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

        {/* Period summary cards */}
        {showFinances && chartTotals.count > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#0B7285]/5 rounded-xl px-3 py-2 text-center">
              <div className="text-sm font-bold text-[#0B7285]">{formatMAD(chartTotals.revenue)}</div>
              <div className="text-[10px] text-gray-500">Revenus</div>
            </div>
            <div className="bg-red-50 rounded-xl px-3 py-2 text-center">
              <div className="text-sm font-bold text-red-600">{formatMAD(chartTotals.costs)}</div>
              <div className="text-[10px] text-gray-500">Coûts</div>
            </div>
            <div className={cn('rounded-xl px-3 py-2 text-center', chartTotals.margin >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
              <div className={cn('text-sm font-bold', chartTotals.margin >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {formatMAD(chartTotals.margin)}
              </div>
              <div className="text-[10px] text-gray-500">
                Marge {chartTotals.revenue > 0 ? `(${Math.round((chartTotals.margin / chartTotals.revenue) * 100)}%)` : ''}
              </div>
            </div>
          </div>
        )}

        <Card>
          <div className="h-56 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B7285" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0B7285" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13, padding: '10px 14px' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any, name: any) => {
                    const v = Number(value);
                    const labels: Record<string, string> = { revenue: 'Revenus', costs: 'Coûts', margin: 'Marge nette' };
                    return [`${v.toLocaleString('fr-FR')} MAD`, labels[String(name)] || name];
                  }) as any}
                  labelFormatter={(label: unknown) => {
                    const point = chartData.find(d => d.label === label);
                    const prefix = chartPeriod === '6m' || chartPeriod === 'tout' ? '' : 'Sem. ';
                    return `${prefix}${label}${point ? ` — ${point.count} turnover${point.count > 1 ? 's' : ''}` : ''}`;
                  }}
                />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="#0B7285" strokeWidth={2.5} fill="url(#gradRevenu)" dot={{ r: 3, fill: '#0B7285' }} />
                <Area type="monotone" dataKey="costs" name="costs" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradCosts)" dot={{ r: 2, fill: '#ef4444' }} />
                <Area type="monotone" dataKey="margin" name="margin" stroke="#22c55e" strokeWidth={2} fill="url(#gradMarge)" dot={{ r: 3, fill: '#22c55e' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-5 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#0B7285] rounded-full inline-block" /> Revenus</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#ef4444] rounded-full inline-block opacity-60" style={{ borderTop: '1px dashed #ef4444' }} /> Coûts</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#22c55e] rounded-full inline-block" /> Marge</span>
          </div>
        </Card>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          className="h-14 text-sm"
          onClick={() => router.push('/turnovers')}
        >
          <Calendar size={18} />
          Missions
        </Button>
        <Button
          variant="secondary"
          className="h-14 text-sm"
          onClick={() => router.push('/finances')}
        >
          <BarChart3 size={18} />
          Finances
        </Button>
      </section>
    </div>
  );
}

// ─── Turnover Card Component ───────────────────────────────
function TurnoverCard({
  turnover, onClick, showRevenue, done
}: {
  turnover: Turnover;
  onClick: () => void;
  showRevenue: boolean;
  done?: boolean;
}) {
  return (
    <Card
      hover
      onClick={onClick}
      className={done ? 'opacity-70' : ''}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('font-semibold text-text-primary', done && 'line-through text-gray-500')}>
              {turnover.apartment?.name || 'Appartement'}
            </span>
            <StatusBadge status={turnover.status} />
          </div>
          <p className="text-sm text-gray-500">
            {turnover.apartment?.client?.name || 'Client'}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            {turnover.time_start && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatTime(turnover.time_start)}
              </span>
            )}
            {turnover.cleaner && (
              <span className="flex items-center gap-1">
                <Sparkles size={13} className="text-accent-dark" />
                {turnover.cleaner.name}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {showRevenue && (
            <div className="font-semibold text-accent-dark">
              {formatMAD(Number(turnover.revenue))}
            </div>
          )}
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>
    </Card>
  );
}
