'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Eye, EyeOff, TrendingUp, TrendingDown, Users, Sparkles,
  AlertCircle, CheckCircle, ChevronRight, ChevronDown, ChevronUp,
  Calendar, Wallet, ArrowDownLeft, ArrowUpRight, Minus, Copy, Check
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort, cn, copyToClipboard } from '@/lib/utils';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format,
  subWeeks, startOfDay, endOfDay
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

export default function FinancesPage() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<TurnoverRow[]>([]);
  const [period, setPeriod] = useState<Period>('mois');
  const [tab, setTab] = useState<Tab>('resume');
  const [loading, setLoading] = useState(true);
  const [showFinances, setShowFinances] = useState(true);
  const [expandedCostBreakdown, setExpandedCostBreakdown] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    } else if (period === 'quinzaine_1') {
      const q = getQuinzaineDates(1);
      startDate = q.start;
      endDate = q.end;
    } else if (period === 'quinzaine_2') {
      const q = getQuinzaineDates(2);
      startDate = q.start;
      endDate = q.end;
    }

    let query = supabase
      .from('turnovers')
      .select('id, date, revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other, cost_other_label, is_paid_by_client, client_paid_date, is_paid_to_cleaner, cleaner_paid_date, status, apartment:apartments(name, type, client:clients(id, name, payment_method, payment_frequency)), cleaner:cleaners(id, name)')
      .neq('status', 'annule')
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data } = await query;
    setTurnovers((data as unknown as TurnoverRow[]) || []);
    setLoading(false);
  }

  // ─── CALCULATIONS ─────────────────────────────
  const totals = useMemo(() => {
    let revenue = 0, revenuePaid = 0, revenueUnpaid = 0;
    let costFemme = 0, costTransport = 0, costProduits = 0, costPressing = 0, costOther = 0;
    let femmePaid = 0, femmeUnpaid = 0;

    for (const t of turnovers) {
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
    // Net cash flow: what actually came in minus what actually went out
    const cashIn = revenuePaid;
    const cashOut = femmePaid + costTransport + costProduits + costPressing + costOther; // non-femme costs assumed paid
    const netCash = cashIn - cashOut;

    return {
      count: turnovers.length, revenue, revenuePaid, revenueUnpaid,
      costFemme, costTransport, costProduits, costPressing, costOther, costTotal,
      femmePaid, femmeUnpaid, margin, marginPct, cashIn, cashOut, netCash,
    };
  }, [turnovers]);

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

  // Per cleaner — with detailed costs
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

  // Generate billing text for a client
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

      {/* Summary Cards — 2x2 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <div className="text-2xl font-bold text-accent-dark">{totals.count}</div>
            <div className="text-xs text-gray-500 mt-1">Turnovers</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-text-primary">
              {showFinances ? formatMAD(totals.revenue) : '•••••'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Revenus total</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {showFinances ? formatMAD(totals.costTotal) : '•••••'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Dépenses total</div>
          </Card>
          <Card className="text-center">
            <div className={cn('text-2xl font-bold', totals.margin >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {showFinances ? formatMAD(totals.margin) : '•••••'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Marge {showFinances && totals.revenue > 0 ? `(${totals.marginPct}%)` : ''}
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
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

      {/* Tab Content */}
      {!loading && (
        <>
          {/* ═══ RÉSUMÉ ═══ */}
          {tab === 'resume' && (
            <div className="space-y-3">
              {/* Cash Flow */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Wallet size={15} className="text-accent-dark" />
                  Flux de trésorerie
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="flex items-center gap-2 text-sm text-gray-600">
                      <ArrowDownLeft size={14} className="text-emerald-600" />
                      Encaissé (clients payés)
                    </span>
                    <span className="font-semibold text-emerald-700">
                      {showFinances ? formatMAD(totals.revenuePaid) : '•••'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="flex items-center gap-2 text-sm text-gray-600">
                      <ArrowUpRight size={14} className="text-red-500" />
                      Décaissé (FM payées)
                    </span>
                    <span className="font-semibold text-red-600">
                      {showFinances ? formatMAD(totals.femmePaid) : '•••'}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Cash net réel</span>
                    <span className={cn('font-bold text-lg', totals.netCash >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {showFinances ? formatMAD(totals.netCash) : '•••••'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Pending amounts */}
              {(totals.revenueUnpaid > 0 || totals.femmeUnpaid > 0) && (
                <Card className="bg-amber-50/50 border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                    <AlertCircle size={15} />
                    En attente
                  </h3>
                  <div className="space-y-1.5">
                    {totals.revenueUnpaid > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-amber-700">À encaisser (clients)</span>
                        <span className="font-semibold text-amber-800">
                          {showFinances ? formatMAD(totals.revenueUnpaid) : '•••'}
                        </span>
                      </div>
                    )}
                    {totals.femmeUnpaid > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-amber-700">À payer (FM)</span>
                        <span className="font-semibold text-amber-800">
                          {showFinances ? formatMAD(totals.femmeUnpaid) : '•••'}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Cost Breakdown */}
              <Card>
                <button
                  onClick={() => setExpandedCostBreakdown(!expandedCostBreakdown)}
                  className="w-full flex items-center justify-between cursor-pointer"
                >
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <TrendingDown size={15} className="text-red-500" />
                    Détail des dépenses
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600 text-sm">
                      {showFinances ? formatMAD(totals.costTotal) : '•••'}
                    </span>
                    {expandedCostBreakdown ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>
                {expandedCostBreakdown && showFinances && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <CostRow label="Femmes de ménage" amount={totals.costFemme} total={totals.costTotal} color="text-blue-600" />
                    <CostRow label="Transport" amount={totals.costTransport} total={totals.costTotal} color="text-purple-600" />
                    <CostRow label="Produits" amount={totals.costProduits} total={totals.costTotal} color="text-orange-600" />
                    <CostRow label="Pressing" amount={totals.costPressing} total={totals.costTotal} color="text-pink-600" />
                    {totals.costOther > 0 && (
                      <CostRow label="Autres" amount={totals.costOther} total={totals.costTotal} color="text-gray-600" />
                    )}
                  </div>
                )}
              </Card>

              {/* Revenue details */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-emerald-600" />
                  Détail revenus
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Revenu moyen / turnover</span>
                    <span className="font-semibold">
                      {showFinances ? (totals.count > 0 ? formatMAD(Math.round(totals.revenue / totals.count)) : '—') : '•••'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Marge moyenne / turnover</span>
                    <span className={cn('font-semibold', totals.margin >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {showFinances ? (totals.count > 0 ? formatMAD(Math.round(totals.margin / totals.count)) : '—') : '•••'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Coût moyen / turnover</span>
                    <span className="font-semibold text-red-600">
                      {showFinances ? (totals.count > 0 ? formatMAD(Math.round(totals.costTotal / totals.count)) : '—') : '•••'}
                    </span>
                  </div>
                </div>
              </Card>
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
                    {/* Unpaid turnovers detail */}
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

// ─── Cost breakdown row ───────────────────────────
function CostRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  if (amount === 0) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">{label}</span>
          <span className={cn('font-semibold', color)}>{formatMAD(amount)}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', color.replace('text-', 'bg-'))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}
