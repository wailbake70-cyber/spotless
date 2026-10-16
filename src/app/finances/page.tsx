'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Eye, EyeOff, TrendingUp, TrendingDown, Users, Sparkles,
  AlertCircle, CheckCircle, ChevronRight, DollarSign
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort, cn } from '@/lib/utils';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

type Period = 'semaine' | 'mois' | 'mois_dernier' | 'tout';
type Tab = 'clients' | 'femmes' | 'impayes';

interface TurnoverRow {
  id: string;
  date: string;
  revenue: number | null;
  cost_femme: number | null;
  cost_transport: number | null;
  cost_produits: number | null;
  cost_pressing: number | null;
  cost_other: number | null;
  is_paid_by_client: boolean;
  is_paid_to_cleaner: boolean;
  status: string;
  apartment: {
    name: string;
    client: {
      id: string;
      name: string;
    } | null;
  } | null;
  cleaner: {
    id: string;
    name: string;
  } | null;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'semaine', label: 'Cette semaine' },
  { key: 'mois', label: 'Ce mois' },
  { key: 'mois_dernier', label: 'Mois dernier' },
  { key: 'tout', label: 'Tout' },
];

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'clients', label: 'Par client', icon: Users },
  { key: 'femmes', label: 'Par femme', icon: Sparkles },
  { key: 'impayes', label: 'Impayés', icon: AlertCircle },
];

export default function FinancesPage() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<TurnoverRow[]>([]);
  const [period, setPeriod] = useState<Period>('mois');
  const [tab, setTab] = useState<Tab>('clients');
  const [loading, setLoading] = useState(true);
  const [showRevenue, setShowRevenue] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [showMargin, setShowMargin] = useState(false);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const now = new Date();

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (period === 'semaine') {
      startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else if (period === 'mois') {
      startDate = format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = format(endOfMonth(now), 'yyyy-MM-dd');
    } else if (period === 'mois_dernier') {
      const lastMonth = subMonths(now, 1);
      startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
    }

    let query = supabase
      .from('turnovers')
      .select('id, date, revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other, is_paid_by_client, is_paid_to_cleaner, status, apartment:apartments(name, client:clients(id, name)), cleaner:cleaners(id, name)')
      .neq('status', 'annule')
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data } = await query;
    setTurnovers((data as unknown as TurnoverRow[]) || []);
    setLoading(false);
  }

  // Totals
  const totals = useMemo(() => {
    let revenue = 0;
    let costFemme = 0;
    let costTotal = 0;
    let count = 0;

    for (const t of turnovers) {
      count++;
      revenue += Number(t.revenue) || 0;
      costFemme += Number(t.cost_femme) || 0;
      costTotal += (Number(t.cost_femme) || 0) + (Number(t.cost_transport) || 0) +
        (Number(t.cost_produits) || 0) + (Number(t.cost_pressing) || 0) + (Number(t.cost_other) || 0);
    }

    return { count, revenue, costFemme, costTotal, margin: revenue - costTotal };
  }, [turnovers]);

  // Per client
  const perClient = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; count: number; unpaid: number }> = {};
    for (const t of turnovers) {
      const clientName = t.apartment?.client?.name || 'Sans client';
      const clientId = t.apartment?.client?.id || 'none';
      if (!map[clientId]) map[clientId] = { name: clientName, revenue: 0, count: 0, unpaid: 0 };
      map[clientId].revenue += Number(t.revenue) || 0;
      map[clientId].count++;
      if (!t.is_paid_by_client) map[clientId].unpaid++;
    }
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [turnovers]);

  // Per cleaner
  const perCleaner = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number; unpaid: number }> = {};
    for (const t of turnovers) {
      const cleanerName = t.cleaner?.name || 'Non assignée';
      const cleanerId = t.cleaner?.id || 'none';
      if (!map[cleanerId]) map[cleanerId] = { name: cleanerName, total: 0, count: 0, unpaid: 0 };
      map[cleanerId].total += Number(t.cost_femme) || 0;
      map[cleanerId].count++;
      if (!t.is_paid_to_cleaner) map[cleanerId].unpaid++;
    }
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [turnovers]);

  // Unpaid
  const unpaidClient = useMemo(() => {
    return turnovers.filter(t => !t.is_paid_by_client);
  }, [turnovers]);

  const unpaidCleaner = useMemo(() => {
    return turnovers.filter(t => !t.is_paid_to_cleaner && t.cleaner);
  }, [turnovers]);

  const totalUnpaidClient = unpaidClient.reduce((sum, t) => sum + (Number(t.revenue) || 0), 0);
  const totalUnpaidCleaner = unpaidCleaner.reduce((sum, t) => sum + (Number(t.cost_femme) || 0), 0);

  // Period label
  const periodLabel = period === 'mois'
    ? format(new Date(), 'MMMM yyyy', { locale: fr })
    : period === 'mois_dernier'
      ? format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: fr })
      : period === 'semaine'
        ? 'Cette semaine'
        : 'Depuis le début';

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto pb-28 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold">Finances</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{periodLabel}</p>
      </div>

      {/* Period Selector */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'flex-1 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
              period === p.key
                ? 'bg-white text-accent-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <div className="text-2xl font-bold text-accent-dark">{totals.count}</div>
            <div className="text-xs text-gray-500 mt-1">Turnovers</div>
          </Card>
          <Card className="text-center cursor-pointer" onClick={() => setShowRevenue(!showRevenue)}>
            <div className="flex items-center justify-center gap-2">
              <div className="text-2xl font-bold text-text-primary">
                {showRevenue ? formatMAD(totals.revenue) : '•••••'}
              </div>
              {showRevenue ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
            </div>
            <div className="text-xs text-gray-500 mt-1">Revenus</div>
          </Card>
          <Card className="text-center cursor-pointer" onClick={() => setShowCost(!showCost)}>
            <div className="flex items-center justify-center gap-2">
              <div className="text-2xl font-bold text-status-annule">
                {showCost ? formatMAD(totals.costTotal) : '•••••'}
              </div>
              {showCost ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
            </div>
            <div className="text-xs text-gray-500 mt-1">Coûts totaux</div>
          </Card>
          <Card className="text-center cursor-pointer" onClick={() => setShowMargin(!showMargin)}>
            <div className="flex items-center justify-center gap-2">
              <div className={`text-2xl font-bold ${totals.margin >= 0 ? 'text-status-termine' : 'text-status-annule'}`}>
                {showMargin ? formatMAD(totals.margin) : '•••••'}
              </div>
              {showMargin ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
            </div>
            <div className="text-xs text-gray-500 mt-1">Ma marge</div>
          </Card>
        </div>
      )}

      {/* Margin % indicator */}
      {!loading && totals.revenue > 0 && (
        <Card className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 text-sm">
            {totals.margin >= 0 ? (
              <TrendingUp size={16} className="text-status-termine" />
            ) : (
              <TrendingDown size={16} className="text-status-annule" />
            )}
            <span className="text-gray-600">Taux de marge</span>
          </div>
          <span className={`font-bold text-lg ${totals.margin >= 0 ? 'text-status-termine' : 'text-status-annule'}`}>
            {Math.round((totals.margin / totals.revenue) * 100)}%
          </span>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
        {TABS.map(t => {
          const Icon = t.icon;
          const badge = t.key === 'impayes' ? unpaidClient.length + unpaidCleaner.length : null;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                tab === t.key
                  ? 'bg-accent-dark text-white'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.key === 'clients' ? 'Clients' : t.key === 'femmes' ? 'FM' : 'Dû'}</span>
              {badge != null && badge > 0 && (
                <span className={cn(
                  'ml-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold',
                  tab === t.key ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                )}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {!loading && (
        <>
          {/* Par Client */}
          {tab === 'clients' && (
            <div className="space-y-2">
              {perClient.length === 0 ? (
                <Card className="text-center py-6 text-gray-400 text-sm">Aucune donnée</Card>
              ) : (
                perClient.map(c => (
                  <Card
                    key={c.id}
                    hover={c.id !== 'none'}
                    onClick={() => c.id !== 'none' && router.push(`/clients/${c.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary truncate">{c.name}</span>
                          {c.unpaid > 0 && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                              {c.unpaid} impayé{c.unpaid > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.count} turnover{c.count > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-bold text-accent-dark">{formatMAD(c.revenue)}</div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Par Femme de ménage */}
          {tab === 'femmes' && (
            <div className="space-y-2">
              {perCleaner.length === 0 ? (
                <Card className="text-center py-6 text-gray-400 text-sm">Aucune donnée</Card>
              ) : (
                perCleaner.map(c => (
                  <Card
                    key={c.id}
                    hover={c.id !== 'none'}
                    onClick={() => c.id !== 'none' && router.push(`/cleaners/${c.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-accent-dark shrink-0" />
                          <span className="font-semibold text-text-primary truncate">{c.name}</span>
                          {c.unpaid > 0 && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                              {c.unpaid} à payer
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 ml-6">
                          {c.count} turnover{c.count > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-bold text-text-primary">{formatMAD(c.total)}</div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Impayés */}
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
                    <span className="text-sm font-bold text-red-600">{formatMAD(totalUnpaidClient)}</span>
                  )}
                </div>
                {unpaidClient.length === 0 ? (
                  <Card className="text-center py-4">
                    <CheckCircle size={20} className="mx-auto text-status-termine mb-1" />
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
                            <span className="font-bold text-red-600 text-sm">{formatMAD(Number(t.revenue))}</span>
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
                    <span className="text-sm font-bold text-orange-600">{formatMAD(totalUnpaidCleaner)}</span>
                  )}
                </div>
                {unpaidCleaner.length === 0 ? (
                  <Card className="text-center py-4">
                    <CheckCircle size={20} className="mx-auto text-status-termine mb-1" />
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
                            <span className="font-bold text-orange-600 text-sm">{formatMAD(Number(t.cost_femme))}</span>
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
