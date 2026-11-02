'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Eye, EyeOff, TrendingUp, TrendingDown, Users, Sparkles,
  AlertCircle, CheckCircle, ChevronRight, ChevronDown, ChevronUp,
  Wallet, ArrowDownLeft, ArrowUpRight, Copy, Check,
  CircleDollarSign, PiggyBank, Activity, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort, cn, copyToClipboard } from '@/lib/utils';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths,
  format, eachDayOfInterval, parseISO, isSameDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

type Period = 'semaine' | 'mois' | 'mois_dernier' | 'quinzaine_1' | 'quinzaine_2' | 'tout';
type Tab = 'resume' | 'clients' | 'femmes' | 'impayes';

interface TurnoverRow {
  id: string;
  date: string;
  revenue: number | null;
  cost_femme: number | null;
  cost_transport: number | null;
  cost_produits: number | null;
  cost_pressing: number | null;
  cost_other: number | null;
  cost_other_label: string | null;
  is_paid_by_client: boolean;
  client_paid_date: string | null;
  is_paid_to_cleaner: boolean;
  cleaner_paid_date: string | null;
  status: string;
  apartment: {
    name: string;
    type: string;
    client: {
      id: string;
      name: string;
      payment_method: string | null;
      payment_frequency: string | null;
    } | null;
  } | null;
  cleaner: {
    id: string;
    name: string;
  } | null;
}

function getQuinzaineDates(which: 1 | 2, monthOffset = 0) {
  const now = new Date();
  const target = monthOffset ? subMonths(now, -monthOffset) : now;
  const year = target.getFullYear();
  const month = target.getMonth();
  if (which === 1) {
    return {
      start: format(new Date(year, month, 1), 'yyyy-MM-dd'),
      end: format(new Date(year, month, 15), 'yyyy-MM-dd'),
      label: `1-15 ${format(new Date(year, month, 1), 'MMMM yyyy', { locale: fr })}`,
    };
  }
  return {
    start: format(new Date(year, month, 16), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd'),
    label: `16-${format(endOfMonth(new Date(year, month, 1)), 'dd')} ${format(new Date(year, month, 1), 'MMMM yyyy', { locale: fr })}`,
  };
}

function getPeriodDates(period: Period): { start: string | null; end: string | null } {
  const now = new Date();
  if (period === 'semaine') {
    return {
      start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  } else if (period === 'mois') {
    return {
      start: format(startOfMonth(now), 'yyyy-MM-dd'),
      end: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
  } else if (period === 'mois_dernier') {
    const lastMonth = subMonths(now, 1);
    return {
      start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
      end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
    };
  } else if (period === 'quinzaine_1') {
    const q = getQuinzaineDates(1);
    return { start: q.start, end: q.end };
  } else if (period === 'quinzaine_2') {
    const q = getQuinzaineDates(2);
    return { start: q.start, end: q.end };
  }
  return { start: null, end: null };
}

// Get the "previous" period for comparison
function getPreviousPeriodDates(period: Period): { start: string | null; end: string | null } {
  const now = new Date();
  if (period === 'semaine') {
    const prevWeekStart = startOfWeek(new Date(now.getTime() - 7 * 86400000), { weekStartsOn: 1 });
    const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
    return {
      start: format(prevWeekStart, 'yyyy-MM-dd'),
      end: format(prevWeekEnd, 'yyyy-MM-dd'),
    };
  } else if (period === 'mois') {
    const lastMonth = subMonths(now, 1);
    return {
      start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
      end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
    };
  } else if (period === 'mois_dernier') {
    const twoMonthsAgo = subMonths(now, 2);
    return {
      start: format(startOfMonth(twoMonthsAgo), 'yyyy-MM-dd'),
      end: format(endOfMonth(twoMonthsAgo), 'yyyy-MM-dd'),
    };
  }
  return { start: null, end: null };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'semaine', label: 'Semaine' },
  { key: 'quinzaine_1', label: 'Q1' },
  { key: 'quinzaine_2', label: 'Q2' },
  { key: 'mois', label: 'Mois' },
  { key: 'mois_dernier', label: 'M-1' },
  { key: 'tout', label: 'Tout' },
];

const TABS: { key: Tab; label: string; mobileLabel: string }[] = [
  { key: 'resume', label: 'Résumé', mobileLabel: 'Résumé' },
  { key: 'clients', label: 'Par client', mobileLabel: 'Clients' },
  { key: 'femmes', label: 'Par femme', mobileLabel: 'FM' },
  { key: 'impayes', label: 'Impayés', mobileLabel: 'Dû' },
];

// Calculate totals from a list of turnovers
function calcTotals(data: TurnoverRow[]) {
  let revenue = 0, revenuePaid = 0, revenueUnpaid = 0;
  let costFemme = 0, costTransport = 0, costProduits = 0, costPressing = 0, costOther = 0;
  let femmePaid = 0, femmeUnpaid = 0;

  for (const t of data) {
    const rev = Number(t.revenue) || 0;
    revenue += rev;
    if (t.is_paid_by_client) revenuePaid += rev;
    else revenueUnpaid += rev;

    const cf = Number(t.cost_femme) || 0;
    costFemme += cf;
    if (t.is_paid_to_cleaner) femmePaid += cf;
    else femmeUnpaid += cf;

    costTransport += Number(t.cost_transport) || 0;
    costProduits += Number(t.cost_produits) || 0;
    costPressing += Number(t.cost_pressing) || 0;
    costOther += Number(t.cost_other) || 0;
  }

  const costTotal = costFemme + costTransport + costProduits + costPressing + costOther;
  const margin = revenue - costTotal;
  const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
  const cashIn = revenuePaid;
  const cashOut = femmePaid + costTransport + costProduits + costPressing + costOther;
  const netCash = cashIn - cashOut;

  return {
    count: data.length, revenue, revenuePaid, revenueUnpaid,
    costFemme, costTransport, costProduits, costPressing, costOther, costTotal,
    femmePaid, femmeUnpaid, margin, marginPct, cashIn, cashOut, netCash,
  };
}

export default function FinancesPage() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<TurnoverRow[]>([]);
  const [prevTurnovers, setPrevTurnovers] = useState<TurnoverRow[]>([]);
  const [period, setPeriod] = useState<Period>('mois');
  const [tab, setTab] = useState<Tab>('resume');
  const [loading, setLoading] = useState(true);
  const [showFinances, setShowFinances] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const SELECT_FIELDS = 'id, date, revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other, cost_other_label, is_paid_by_client, client_paid_date, is_paid_to_cleaner, cleaner_paid_date, status, apartment:apartments(name, type, client:clients(id, name, payment_method, payment_frequency)), cleaner:cleaners(id, name)';

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();

    const { start, end } = getPeriodDates(period);
    const prev = getPreviousPeriodDates(period);

    // Current period query
    let query = supabase
      .from('turnovers')
      .select(SELECT_FIELDS)
      .neq('status', 'annule')
      .order('date', { ascending: false });

    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);

    // Previous period query (for comparison)
    let prevQuery = supabase
      .from('turnovers')
      .select(SELECT_FIELDS)
      .neq('status', 'annule')
      .order('date', { ascending: false });

    if (prev.start) prevQuery = prevQuery.gte('date', prev.start);
    if (prev.end) prevQuery = prevQuery.lte('date', prev.end);

    const [currentResult, prevResult] = await Promise.all([
      query,
      prev.start ? prevQuery : Promise.resolve({ data: [] }),
    ]);

    setTurnovers((currentResult.data as unknown as TurnoverRow[]) || []);
    setPrevTurnovers(((prevResult as { data: unknown[] | null }).data as unknown as TurnoverRow[]) || []);
    setLoading(false);
  }

  // ─── CALCULATIONS ─────────────────────────────
  const totals = useMemo(() => calcTotals(turnovers), [turnovers]);
  const prevTotals = useMemo(() => calcTotals(prevTurnovers), [prevTurnovers]);

  // Trend calculation
  function getTrend(current: number, previous: number): { pct: number; direction: 'up' | 'down' | 'flat' } {
    if (previous === 0) return { pct: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'flat' };
    const pct = Math.round(((current - previous) / previous) * 100);
    return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
  }

  // Chart data — daily aggregation
  const chartData = useMemo(() => {
    if (turnovers.length === 0) return [];

    const { start, end } = getPeriodDates(period);
    if (!start || !end) {
      // For "tout", group by week
      const weekMap: Record<string, { label: string; revenue: number; costs: number; margin: number }> = {};
      for (const t of turnovers) {
        const d = parseISO(t.date);
        const weekKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const label = format(startOfWeek(d, { weekStartsOn: 1 }), 'd MMM', { locale: fr });
        if (!weekMap[weekKey]) weekMap[weekKey] = { label, revenue: 0, costs: 0, margin: 0 };
        const rev = Number(t.revenue) || 0;
        const cost = (Number(t.cost_femme) || 0) + (Number(t.cost_transport) || 0) +
          (Number(t.cost_produits) || 0) + (Number(t.cost_pressing) || 0) + (Number(t.cost_other) || 0);
        weekMap[weekKey].revenue += rev;
        weekMap[weekKey].costs += cost;
        weekMap[weekKey].margin += rev - cost;
      }
      return Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);
    }

    const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
    return days
      .map(day => {
        const dayTurnovers = turnovers.filter(t => isSameDay(parseISO(t.date), day));
        const rev = dayTurnovers.reduce((s, t) => s + (Number(t.revenue) || 0), 0);
        const cost = dayTurnovers.reduce((s, t) =>
          s + (Number(t.cost_femme) || 0) + (Number(t.cost_transport) || 0) +
          (Number(t.cost_produits) || 0) + (Number(t.cost_pressing) || 0) + (Number(t.cost_other) || 0), 0);
        return {
          label: format(day, 'd', { locale: fr }),
          fullLabel: format(day, 'd MMM', { locale: fr }),
          revenue: rev,
          costs: cost,
          margin: rev - cost,
        };
      })
      .filter((_, i, arr) => {
        // For month view, show every day but only label some
        return true;
      });
  }, [turnovers, period]);

  // Per client
  const perClient = useMemo(() => {
    const map: Record<string, {
      name: string; revenue: number; revenuePaid: number; count: number;
      unpaidCount: number; unpaidAmount: number; paymentMethod: string | null;
      paymentFrequency: string | null;
    }> = {};
    for (const t of turnovers) {
      const client = t.apartment?.client;
      const clientName = client?.name || 'Sans client';
      const clientId = client?.id || 'none';
      if (!map[clientId]) map[clientId] = {
        name: clientName, revenue: 0, revenuePaid: 0, count: 0,
        unpaidCount: 0, unpaidAmount: 0,
        paymentMethod: client?.payment_method || null,
        paymentFrequency: client?.payment_frequency || null,
      };
      const rev = Number(t.revenue) || 0;
      map[clientId].revenue += rev;
      map[clientId].count++;
      if (t.is_paid_by_client) {
        map[clientId].revenuePaid += rev;
      } else {
        map[clientId].unpaidCount++;
        map[clientId].unpaidAmount += rev;
      }
    }
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [turnovers]);

  // Per cleaner
  const perCleaner = useMemo(() => {
    const map: Record<string, {
      name: string; totalCost: number; paidAmount: number; unpaidAmount: number;
      count: number; unpaidCount: number;
      turnovers: TurnoverRow[];
    }> = {};
    for (const t of turnovers) {
      const cleanerName = t.cleaner?.name || 'Non assignée';
      const cleanerId = t.cleaner?.id || 'none';
      if (!map[cleanerId]) map[cleanerId] = {
        name: cleanerName, totalCost: 0, paidAmount: 0, unpaidAmount: 0,
        count: 0, unpaidCount: 0, turnovers: [],
      };
      const cf = Number(t.cost_femme) || 0;
      map[cleanerId].totalCost += cf;
      map[cleanerId].count++;
      map[cleanerId].turnovers.push(t);
      if (t.is_paid_to_cleaner) {
        map[cleanerId].paidAmount += cf;
      } else {
        map[cleanerId].unpaidCount++;
        map[cleanerId].unpaidAmount += cf;
      }
    }
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [turnovers]);

  // Unpaid
  const unpaidClient = turnovers.filter(t => !t.is_paid_by_client);
  const unpaidCleaner = turnovers.filter(t => !t.is_paid_to_cleaner && t.cleaner);
  const totalUnpaidClient = unpaidClient.reduce((s, t) => s + (Number(t.revenue) || 0), 0);
  const totalUnpaidCleaner = unpaidCleaner.reduce((s, t) => s + (Number(t.cost_femme) || 0), 0);

  // Period label
  const periodLabel = useMemo(() => {
    if (period === 'mois') return format(new Date(), 'MMMM yyyy', { locale: fr });
    if (period === 'mois_dernier') return format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: fr });
    if (period === 'semaine') return 'Cette semaine';
    if (period === 'quinzaine_1') return getQuinzaineDates(1).label;
    if (period === 'quinzaine_2') return getQuinzaineDates(2).label;
    return 'Depuis le début';
  }, [period]);

  // Generate billing text
  function generateBillingText(clientId: string) {
    const clientTurnovers = turnovers.filter(
      t => t.apartment?.client?.id === clientId && !t.is_paid_by_client
    );
    if (clientTurnovers.length === 0) return '';
    const clientName = clientTurnovers[0]?.apartment?.client?.name || 'Client';
    let text = `📋 Relevé SPOTLESS — ${clientName}\n`;
    text += `Période: ${periodLabel}\n\n`;
    let total = 0;
    for (const t of clientTurnovers) {
      const rev = Number(t.revenue) || 0;
      total += rev;
      text += `• ${formatDateShort(t.date)} — ${t.apartment?.name || 'Appart'} — ${rev} MAD\n`;
    }
    text += `\n💰 TOTAL À PAYER: ${total} MAD\n`;
    text += `\nMerci pour votre confiance !\nSPOTLESS — Rien ne nous échappe`;
    return text;
  }

  async function handleCopyBilling(clientId: string) {
    const text = generateBillingText(clientId);
    await copyToClipboard(text);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Cash collection percentage
  const collectionPct = totals.revenue > 0 ? Math.round((totals.revenuePaid / totals.revenue) * 100) : 0;

  // Revenue trend
  const revTrend = getTrend(totals.revenue, prevTotals.revenue);
  const marginTrend = getTrend(totals.margin, prevTotals.margin);
  const countTrend = getTrend(totals.count, prevTotals.count);

  // Has previous data for comparison
  const hasPrev = prevTotals.count > 0 && period !== 'tout';

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto pb-28 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Finances</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{periodLabel}</p>
        </div>
        <button
          onClick={() => setShowFinances(!showFinances)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-sm text-gray-600 hover:bg-gray-200 transition cursor-pointer"
        >
          {showFinances ? <EyeOff size={15} /> : <Eye size={15} />}
          {showFinances ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {/* Period Selector */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'flex-1 py-2.5 px-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer',
              period === p.key
                ? 'bg-white text-accent-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (
        <>
          {/* ═══════════ 3 KPI HERO CARDS ═══════════ */}
          <div className="grid grid-cols-3 gap-2">
            {/* Revenue */}
            <KpiCard
              icon={<CircleDollarSign size={16} />}
              iconBg="bg-teal-50"
              iconColor="text-accent-dark"
              label="Revenus"
              value={showFinances ? formatMAD(totals.revenue) : '•••'}
              trend={hasPrev ? revTrend : undefined}
              showFinances={showFinances}
            />
            {/* Margin */}
            <KpiCard
              icon={<PiggyBank size={16} />}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              label="Marge"
              value={showFinances ? formatMAD(totals.margin) : '•••'}
              valueColor={totals.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}
              sub={showFinances && totals.revenue > 0 ? `${totals.marginPct}%` : undefined}
              trend={hasPrev ? marginTrend : undefined}
              showFinances={showFinances}
            />
            {/* Turnovers */}
            <KpiCard
              icon={<Activity size={16} />}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              label="Turnovers"
              value={`${totals.count}`}
              trend={hasPrev ? countTrend : undefined}
              showFinances={true}
            />
          </div>

          {/* ═══════════ CASH POSITION — THE MOST IMPORTANT ═══════════ */}
          <Card className={cn(
            'relative overflow-hidden',
            totals.netCash >= 0 ? 'border-emerald-200' : 'border-red-200'
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-lg', totals.netCash >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                  <Wallet size={16} className={totals.netCash >= 0 ? 'text-emerald-600' : 'text-red-500'} />
                </div>
                <span className="text-sm font-semibold text-gray-700">Cash réel</span>
              </div>
              <span className={cn(
                'text-xl font-bold',
                !showFinances ? 'text-gray-400' : totals.netCash >= 0 ? 'text-emerald-700' : 'text-red-600'
              )}>
                {showFinances ? formatMAD(totals.netCash) : '•••••'}
              </span>
            </div>

            {showFinances && (
              <>
                {/* Collection progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Encaissé</span>
                    <span className="font-semibold text-gray-700">{collectionPct}% collecté</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        collectionPct >= 75 ? 'bg-emerald-500' :
                        collectionPct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                      )}
                      style={{ width: `${collectionPct}%` }}
                    />
                  </div>
                </div>

                {/* In/Out breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-emerald-50/60 rounded-lg p-2.5">
                    <ArrowDownLeft size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-emerald-600 font-medium">Encaissé</div>
                      <div className="text-sm font-bold text-emerald-700">{formatMAD(totals.revenuePaid)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-red-50/60 rounded-lg p-2.5">
                    <ArrowUpRight size={14} className="text-red-500 shrink-0" />
                    <div>
                      <div className="text-[10px] text-red-500 font-medium">Décaissé</div>
                      <div className="text-sm font-bold text-red-600">{formatMAD(totals.cashOut)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* ═══════════ ACTION ALERTS ═══════════ */}
          {showFinances && (totals.revenueUnpaid > 0 || totals.femmeUnpaid > 0) && (
            <div className="space-y-2">
              {totals.revenueUnpaid > 0 && (
                <button
                  onClick={() => setTab('impayes')}
                  className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left cursor-pointer hover:bg-amber-100/70 transition"
                >
                  <div className="p-1.5 bg-amber-100 rounded-lg shrink-0">
                    <AlertCircle size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-amber-800">
                      {formatMAD(totals.revenueUnpaid)} à encaisser
                    </div>
                    <div className="text-xs text-amber-600">
                      {unpaidClient.length} turnover{unpaidClient.length > 1 ? 's' : ''} impayé{unpaidClient.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-amber-400 shrink-0" />
                </button>
              )}
              {totals.femmeUnpaid > 0 && (
                <button
                  onClick={() => setTab('femmes')}
                  className="w-full flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3 text-left cursor-pointer hover:bg-orange-100/70 transition"
                >
                  <div className="p-1.5 bg-orange-100 rounded-lg shrink-0">
                    <Sparkles size={16} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-orange-800">
                      {formatMAD(totals.femmeUnpaid)} à payer aux FM
                    </div>
                    <div className="text-xs text-orange-600">
                      {unpaidCleaner.length} turnover{unpaidCleaner.length > 1 ? 's' : ''} non payé{unpaidCleaner.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-orange-400 shrink-0" />
                </button>
              )}
            </div>
          )}

          {/* ═══════════ CHART — Revenue par jour ═══════════ */}
          {showFinances && chartData.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-accent-dark" />
                Activité
              </h3>
              <div className="h-44 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={1}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#999' }}
                      interval={period === 'mois' || period === 'mois_dernier' ? 2 : 0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#999' }}
                      width={35}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        `${value} MAD`,
                        name === 'revenue' ? 'Revenus' : name === 'margin' ? 'Marge' : 'Coûts'
                      ]}
                      labelFormatter={(label: unknown) => String(label)}
                    />
                    <Bar
                      dataKey="revenue"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={period === 'tout' ? 28 : 16}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.revenue > 0 ? '#0E8C9A' : '#e5e7eb'}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="margin"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={period === 'tout' ? 28 : 16}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.margin >= 0 ? '#10b981' : '#ef4444'}
                          fillOpacity={0.6}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Revenus
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 opacity-60" /> Marge
                </span>
              </div>
            </Card>
          )}

          {/* ═══════════ TABS ═══════════ */}
          <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
            {TABS.map(t => {
              const badge = t.key === 'impayes' ? unpaidClient.length + unpaidCleaner.length : null;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-2.5 px-1 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer',
                    tab === t.key
                      ? 'bg-accent-dark text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.mobileLabel}</span>
                  {badge != null && badge > 0 && (
                    <span className={cn(
                      'ml-0.5 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold',
                      tab === t.key ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                    )}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ═══════════ TAB CONTENT ═══════════ */}

          {/* ═══ RÉSUMÉ ═══ */}
          {tab === 'resume' && (
            <div className="space-y-3">
              {/* Key metrics row */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-emerald-600" />
                  Moyennes
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-accent-dark">
                      {showFinances && totals.count > 0 ? formatMAD(Math.round(totals.revenue / totals.count)).replace(' MAD', '') : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Rev/TO</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className={cn('text-lg font-bold', totals.margin >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {showFinances && totals.count > 0 ? formatMAD(Math.round(totals.margin / totals.count)).replace(' MAD', '') : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Marge/TO</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {showFinances && totals.count > 0 ? formatMAD(Math.round(totals.costTotal / totals.count)).replace(' MAD', '') : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Coût/TO</div>
                  </div>
                </div>
              </Card>

              {/* Cost Breakdown — Horizontal Bars */}
              {showFinances && totals.costTotal > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <TrendingDown size={15} className="text-red-500" />
                    Dépenses
                    <span className="ml-auto text-sm font-bold text-red-600">{formatMAD(totals.costTotal)}</span>
                  </h3>
                  <div className="space-y-2.5">
                    <CostRow label="Femmes de ménage" amount={totals.costFemme} total={totals.costTotal} color="#3b82f6" />
                    <CostRow label="Transport" amount={totals.costTransport} total={totals.costTotal} color="#8b5cf6" />
                    <CostRow label="Produits" amount={totals.costProduits} total={totals.costTotal} color="#f97316" />
                    <CostRow label="Pressing" amount={totals.costPressing} total={totals.costTotal} color="#ec4899" />
                    {totals.costOther > 0 && (
                      <CostRow label="Autres" amount={totals.costOther} total={totals.costTotal} color="#6b7280" />
                    )}
                  </div>
                </Card>
              )}

              {/* Comparison with previous period */}
              {hasPrev && showFinances && (
                <Card className="bg-gray-50/50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <Activity size={15} className="text-blue-500" />
                    vs. période précédente
                  </h3>
                  <div className="space-y-2">
                    <ComparisonRow label="Revenus" current={totals.revenue} previous={prevTotals.revenue} />
                    <ComparisonRow label="Marge" current={totals.margin} previous={prevTotals.margin} />
                    <ComparisonRow label="Turnovers" current={totals.count} previous={prevTotals.count} isCount />
                    <ComparisonRow label="Marge %" current={totals.marginPct} previous={prevTotals.marginPct} isCount suffix="%" />
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ═══ PAR CLIENT ═══ */}
          {tab === 'clients' && (
            <div className="space-y-2">
              {perClient.length === 0 ? (
                <Card className="text-center py-6 text-gray-400 text-sm">Aucune donnée</Card>
              ) : (
                perClient.map(c => (
                  <Card key={c.id}>
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => c.id !== 'none' && router.push(`/clients/${c.id}`)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-text-primary">{c.name}</span>
                          {c.paymentFrequency && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {c.paymentFrequency === 'immediat' ? 'Immédiat' :
                               c.paymentFrequency === 'hebdo' ? 'Hebdo' :
                               c.paymentFrequency === 'bi_mensuel' ? 'Bi-mens.' : 'Mensuel'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{c.count} TO</span>
                          {showFinances && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600 font-medium">
                                {formatMAD(c.revenuePaid)} payé
                              </span>
                            </>
                          )}
                        </div>
                        {/* Mini revenue bar */}
                        {showFinances && totals.revenue > 0 && (
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${Math.round((c.revenue / totals.revenue) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-bold text-accent-dark">
                          {showFinances ? formatMAD(c.revenue) : '•••'}
                        </div>
                        {c.unpaidCount > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 justify-end">
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                              {c.unpaidCount} dû · {showFinances ? formatMAD(c.unpaidAmount) : '•••'}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyBilling(c.id); }}
                              className="p-1 rounded hover:bg-gray-100 cursor-pointer transition"
                              title="Copier le relevé"
                            >
                              {copiedId === c.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-gray-400" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ═══ PAR FEMME ═══ */}
          {tab === 'femmes' && (
            <div className="space-y-3">
              {perCleaner.length === 0 ? (
                <Card className="text-center py-6 text-gray-400 text-sm">Aucune donnée</Card>
              ) : (
                perCleaner.filter(c => c.id !== 'none').map(c => (
                  <Card key={c.id}>
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => router.push(`/cleaners/${c.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-accent-dark shrink-0" />
                          <span className="font-semibold text-text-primary">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-6 text-xs text-gray-500">
                          <span>{c.count} TO</span>
                          {showFinances && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600 font-medium">
                                {formatMAD(c.paidAmount)} versé
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-bold text-text-primary">
                          {showFinances ? formatMAD(c.totalCost) : '•••'}
                        </div>
                        {c.unpaidCount > 0 && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                            {c.unpaidCount} à payer · {showFinances ? formatMAD(c.unpaidAmount) : '•••'}
                          </span>
                        )}
                      </div>
                    </div>
                    {c.unpaidCount > 0 && showFinances && (
                      <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                        <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">
                          À payer ({c.unpaidCount})
                        </p>
                        {c.turnovers.filter(t => !t.is_paid_to_cleaner).map(t => (
                          <div key={t.id} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500">
                              {formatDateShort(t.date)} — {t.apartment?.name || 'Appart'}
                            </span>
                            <span className="font-medium text-orange-700">{formatMAD(Number(t.cost_femme))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ═══ IMPAYÉS ═══ */}
          {tab === 'impayes' && (
            <div className="space-y-4">
              {/* Client unpaid */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Users size={14} />
                    Clients qui doivent
                  </h3>
                  {totalUnpaidClient > 0 && (
                    <span className="text-sm font-bold text-red-600">
                      {showFinances ? formatMAD(totalUnpaidClient) : '•••'}
                    </span>
                  )}
                </div>
                {unpaidClient.length === 0 ? (
                  <Card className="text-center py-4">
                    <CheckCircle size={20} className="mx-auto text-emerald-600 mb-1" />
                    <p className="text-sm text-gray-500">Tout est payé !</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {unpaidClient.map(t => (
                      <Card
                        key={t.id}
                        hover
                        onClick={() => router.push(`/turnovers/${t.id}`)}
                        className="border-l-[3px] border-l-red-400"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-text-primary text-sm">
                              {t.apartment?.name || 'Appart'}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>{t.apartment?.client?.name || '—'}</span>
                              <span className="text-gray-300">·</span>
                              <span>{formatDateShort(t.date)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="font-bold text-red-600 text-sm">
                              {showFinances ? formatMAD(Number(t.revenue)) : '•••'}
                            </span>
                            <ChevronRight size={16} className="text-gray-300" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Cleaner unpaid */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    Femmes à payer
                  </h3>
                  {totalUnpaidCleaner > 0 && (
                    <span className="text-sm font-bold text-orange-600">
                      {showFinances ? formatMAD(totalUnpaidCleaner) : '•••'}
                    </span>
                  )}
                </div>
                {unpaidCleaner.length === 0 ? (
                  <Card className="text-center py-4">
                    <CheckCircle size={20} className="mx-auto text-emerald-600 mb-1" />
                    <p className="text-sm text-gray-500">Tout est payé !</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {unpaidCleaner.map(t => (
                      <Card
                        key={t.id}
                        hover
                        onClick={() => router.push(`/turnovers/${t.id}`)}
                        className="border-l-[3px] border-l-orange-400"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-text-primary text-sm">
                              {t.apartment?.name || 'Appart'}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>{t.cleaner?.name || '—'}</span>
                              <span className="text-gray-300">·</span>
                              <span>{formatDateShort(t.date)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="font-bold text-orange-600 text-sm">
                              {showFinances ? formatMAD(Number(t.cost_femme)) : '•••'}
                            </span>
                            <ChevronRight size={16} className="text-gray-300" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── KPI Card Component ───────────────────────────
function KpiCard({
  icon, iconBg, iconColor, label, value, valueColor, sub, trend, showFinances,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  trend?: { pct: number; direction: 'up' | 'down' | 'flat' };
  showFinances: boolean;
}) {
  return (
    <Card className="text-center relative">
      <div className={cn('mx-auto w-7 h-7 rounded-lg flex items-center justify-center mb-1.5', iconBg)}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className={cn('text-lg font-bold leading-tight', valueColor || 'text-text-primary')}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">{sub}</div>
      )}
      <div className="text-[10px] text-gray-500 mt-1">{label}</div>
      {/* Trend badge */}
      {trend && showFinances && trend.pct > 0 && (
        <div className={cn(
          'absolute top-1.5 right-1.5 flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded-full',
          trend.direction === 'up' ? 'bg-emerald-50 text-emerald-600' :
          trend.direction === 'down' ? 'bg-red-50 text-red-500' :
          'bg-gray-50 text-gray-400'
        )}>
          {trend.direction === 'up' ? <ArrowUp size={8} /> :
           trend.direction === 'down' ? <ArrowDown size={8} /> :
           <Minus size={8} />}
          {trend.pct}%
        </div>
      )}
    </Card>
  );
}

// ─── Cost breakdown row ───────────────────────────
function CostRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  if (amount === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color }}>{formatMAD(amount)}</span>
          <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Comparison row ───────────────────────────
function ComparisonRow({
  label, current, previous, isCount, suffix,
}: {
  label: string;
  current: number;
  previous: number;
  isCount?: boolean;
  suffix?: string;
}) {
  const diff = current - previous;
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0);
  const isPositive = diff > 0;
  const isNeutral = diff === 0;
  const s = suffix || '';

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">
          {isCount ? `${current}${s}` : formatMAD(current)}
        </span>
        <span className="text-xs text-gray-400">vs</span>
        <span className="text-xs text-gray-500">
          {isCount ? `${previous}${s}` : formatMAD(previous)}
        </span>
        {!isNeutral && (
          <span className={cn(
            'flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          )}>
            {isPositive ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
            {Math.abs(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}
