'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FileText, Calendar, Building2, Users, Copy, Check,
  CheckCircle, AlertCircle, X, ChevronDown, Filter,
  Plus, Trash2, Eye, PenLine, Hash
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { formatMAD, formatDateShort, cn, copyToClipboard } from '@/lib/utils';
import {
  startOfMonth, endOfMonth, subMonths, format, parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';

/* ─── Types ─── */
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

interface ClientOption {
  id: string;
  name: string;
}

interface InvoiceLine {
  id: string;
  date: string;
  description: string;
  amount: string;
}

type MainTab = 'releves' | 'nouvelle';

/* ─── Helpers ─── */
function getQuinzaineDates(which: 1 | 2) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (which === 1) {
    return {
      start: format(new Date(year, month, 1), 'yyyy-MM-dd'),
      end: format(new Date(year, month, 15), 'yyyy-MM-dd'),
      label: `1-15 ${format(new Date(year, month, 1), 'MMMM', { locale: fr })}`,
    };
  }
  return {
    start: format(new Date(year, month, 16), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd'),
    label: `16-${format(endOfMonth(new Date(year, month, 1)), 'dd')} ${format(new Date(year, month, 1), 'MMMM', { locale: fr })}`,
  };
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `SPOT-${y}${m}-${rand}`;
}

function makeEmptyLine(): InvoiceLine {
  return {
    id: crypto.randomUUID(),
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: '',
  };
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function FacturesPage() {
  const [mainTab, setMainTab] = useState<MainTab>('releves');

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto pb-28 lg:pb-6">
      {/* ── Page title ── */}
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <FileText size={24} className="text-accent-dark" />
          Factures
        </h1>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {([
          { key: 'releves' as MainTab, label: 'Relevés', icon: FileText },
          { key: 'nouvelle' as MainTab, label: 'Nouvelle Facture', icon: PenLine },
        ]).map(tab => {
          const Icon = tab.icon;
          const active = mainTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer',
                active
                  ? 'bg-white text-accent-dark shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      {mainTab === 'releves' ? <RelevesTab /> : <NouvelleFactureTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 1: RELEVÉS (existing invoice cards)
   ═══════════════════════════════════════════════ */
function RelevesTab() {
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [aptFilter, setAptFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [turnovers, setTurnovers] = useState<TurnoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const SELECT_FIELDS = 'id, date, revenue, cost_femme, cost_transport, cost_produits, cost_pressing, cost_other, cost_other_label, is_paid_by_client, client_paid_date, is_paid_to_cleaner, cleaner_paid_date, status, apartment:apartments(name, type, client:clients(id, name, payment_method, payment_frequency)), cleaner:cleaners(id, name)';

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('turnovers')
      .select(SELECT_FIELDS)
      .neq('status', 'annule')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    setTurnovers((data as unknown as TurnoverRow[]) || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let data = turnovers;
    if (aptFilter !== 'all') data = data.filter(t => t.apartment?.name === aptFilter);
    if (clientFilter !== 'all') data = data.filter(t => t.apartment?.client?.id === clientFilter);
    return data;
  }, [turnovers, aptFilter, clientFilter]);

  const apartments = useMemo(() => {
    const names = new Set<string>();
    for (const t of turnovers) if (t.apartment?.name) names.add(t.apartment.name);
    return Array.from(names).sort();
  }, [turnovers]);

  const clients = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of turnovers) {
      const c = t.apartment?.client;
      if (c?.id) map[c.id] = c.name;
    }
    return Object.entries(map).sort(([, a], [, b]) => a.localeCompare(b));
  }, [turnovers]);

  const byClient = useMemo(() => {
    const map: Record<string, {
      name: string;
      turnovers: TurnoverRow[];
      total: number;
      paid: number;
      unpaid: number;
      unpaidCount: number;
    }> = {};
    for (const t of filtered) {
      const client = t.apartment?.client;
      const clientId = client?.id || 'none';
      const clientName = client?.name || 'Sans client';
      if (!map[clientId]) map[clientId] = { name: clientName, turnovers: [], total: 0, paid: 0, unpaid: 0, unpaidCount: 0 };
      const rev = Number(t.revenue) || 0;
      map[clientId].turnovers.push(t);
      map[clientId].total += rev;
      if (t.is_paid_by_client) {
        map[clientId].paid += rev;
      } else {
        map[clientId].unpaid += rev;
        map[clientId].unpaidCount++;
      }
    }
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const grandTotal = filtered.reduce((s, t) => s + (Number(t.revenue) || 0), 0);
  const grandPaid = filtered.filter(t => t.is_paid_by_client).reduce((s, t) => s + (Number(t.revenue) || 0), 0);
  const grandUnpaid = grandTotal - grandPaid;

  const periodLabel = useMemo(() => {
    return `${format(parseISO(dateFrom), 'd MMM', { locale: fr })} → ${format(parseISO(dateTo), 'd MMM yyyy', { locale: fr })}`;
  }, [dateFrom, dateTo]);

  function generateInvoiceText(clientId: string) {
    const clientData = byClient.find(c => c.id === clientId);
    if (!clientData) return '';
    const fromLabel = format(parseISO(dateFrom), 'd MMM yyyy', { locale: fr });
    const toLabel = format(parseISO(dateTo), 'd MMM yyyy', { locale: fr });
    let text = `📋 RELEVÉ SPOTLESS\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Client: ${clientData.name}\n`;
    text += `Période: ${fromLabel} → ${toLabel}\n`;
    if (aptFilter !== 'all') text += `Appartement: ${aptFilter}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const grouped: Record<string, TurnoverRow[]> = {};
    for (const t of clientData.turnovers) {
      const aptName = t.apartment?.name || 'Appart';
      if (!grouped[aptName]) grouped[aptName] = [];
      grouped[aptName].push(t);
    }

    for (const [aptName, tos] of Object.entries(grouped)) {
      text += `🏠 ${aptName}\n`;
      let subtotal = 0;
      for (const t of tos) {
        const rev = Number(t.revenue) || 0;
        subtotal += rev;
        const paid = t.is_paid_by_client ? '✅' : '⏳';
        text += `  ${paid} ${format(parseISO(t.date), 'dd/MM/yyyy')} — ${rev} MAD\n`;
      }
      text += `  Sous-total: ${subtotal} MAD\n\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 TOTAL: ${clientData.total} MAD\n`;
    if (clientData.paid > 0) text += `✅ Payé: ${clientData.paid} MAD\n`;
    if (clientData.unpaid > 0) text += `⏳ Reste à payer: ${clientData.unpaid} MAD\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `\nMerci pour votre confiance !\nSPOTLESS — Rien ne nous échappe 🧹✨`;
    return text;
  }

  async function handleCopy(clientId: string) {
    const text = generateInvoiceText(clientId);
    await copyToClipboard(text);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  async function handleCopyAll() {
    let text = '';
    for (const client of byClient) {
      text += generateInvoiceText(client.id);
      text += '\n\n═══════════════════════\n\n';
    }
    await copyToClipboard(text);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2500);
  }

  const hasActiveFilters = aptFilter !== 'all' || clientFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Header with period & copy all */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{periodLabel}</p>
        {byClient.length > 1 && (
          <button
            onClick={handleCopyAll}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
              copiedId === 'all'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {copiedId === 'all' ? <><Check size={12} /> Copié !</> : <><Copy size={12} /> Tout copier</>}
          </button>
        )}
      </div>

      {/* Date Range Picker */}
      <Card>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        </div>

        {/* Quick period buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: 'Ce mois', fn: () => { setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); } },
            { label: 'Mois -1', fn: () => { const lm = subMonths(new Date(), 1); setDateFrom(format(startOfMonth(lm), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(lm), 'yyyy-MM-dd')); } },
            { label: 'Q1', fn: () => { const q = getQuinzaineDates(1); setDateFrom(q.start); setDateTo(q.end); } },
            { label: 'Q2', fn: () => { const q = getQuinzaineDates(2); setDateFrom(q.start); setDateTo(q.end); } },
            { label: '3 mois', fn: () => { setDateFrom(format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); } },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-accent-bg hover:text-accent-dark transition cursor-pointer"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-1.5 mt-3 text-xs font-medium cursor-pointer transition',
            hasActiveFilters ? 'text-accent-dark' : 'text-gray-400 hover:text-gray-600'
          )}
        >
          <Filter size={12} />
          Filtres
          {hasActiveFilters && (
            <span className="bg-accent text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
              {(aptFilter !== 'all' ? 1 : 0) + (clientFilter !== 'all' ? 1 : 0)}
            </span>
          )}
          <ChevronDown size={12} className={cn('transition-transform', showFilters && 'rotate-180')} />
        </button>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 size={10} /> Appartement
              </label>
              <div className="relative">
                <select
                  value={aptFilter}
                  onChange={e => setAptFilter(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none bg-white cursor-pointer"
                >
                  <option value="all">Tous</option>
                  {apartments.map(apt => (
                    <option key={apt} value={apt}>{apt}</option>
                  ))}
                </select>
                {aptFilter !== 'all' && (
                  <button onClick={() => setAptFilter('all')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 cursor-pointer">
                    <X size={12} className="text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users size={10} /> Client
              </label>
              <div className="relative">
                <select
                  value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none bg-white cursor-pointer"
                >
                  <option value="all">Tous</option>
                  {clients.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                {clientFilter !== 'all' && (
                  <button onClick={() => setClientFilter('all')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 cursor-pointer">
                    <X size={12} className="text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-32 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <FileText size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">Aucun turnover trouvé</p>
          <p className="text-xs text-gray-300 mt-1">Changez les dates ou les filtres</p>
        </Card>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <div className="text-lg font-bold text-accent-dark">{formatMAD(grandTotal)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Total</div>
            </div>
            <div className="bg-white rounded-xl border border-emerald-100 p-3 text-center">
              <div className="text-lg font-bold text-emerald-600">{formatMAD(grandPaid)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Payé</div>
            </div>
            <div className="bg-white rounded-xl border border-amber-100 p-3 text-center">
              <div className="text-lg font-bold text-amber-600">{formatMAD(grandUnpaid)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Impayé</div>
            </div>
          </div>

          {/* Invoice cards per client */}
          <div className="space-y-3">
            {byClient.map(client => (
              <Card key={client.id} className="border-l-[3px] border-l-accent">
                {/* Client header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">{client.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {client.turnovers.length} turnover{client.turnovers.length > 1 ? 's' : ''}
                      {client.unpaidCount > 0 && (
                        <span className="text-amber-600"> · {client.unpaidCount} impayé{client.unpaidCount > 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(client.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0',
                      copiedId === client.id
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-accent text-white hover:bg-accent-dark active:scale-95'
                    )}
                  >
                    {copiedId === client.id ? <><Check size={13} /> Copié !</> : <><Copy size={13} /> Copier</>}
                  </button>
                </div>

                {/* Turnovers grouped by apartment */}
                <div className="space-y-2">
                  {(() => {
                    const grouped: Record<string, TurnoverRow[]> = {};
                    for (const t of client.turnovers) {
                      const apt = t.apartment?.name || 'Appart';
                      if (!grouped[apt]) grouped[apt] = [];
                      grouped[apt].push(t);
                    }
                    return Object.entries(grouped).map(([aptName, tos]) => {
                      const subtotal = tos.reduce((s, t) => s + (Number(t.revenue) || 0), 0);
                      return (
                        <div key={aptName} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                              <Building2 size={12} className="text-accent-dark" />
                              {aptName}
                            </span>
                            <span className="text-xs font-bold text-accent-dark">{formatMAD(subtotal)}</span>
                          </div>
                          <div className="space-y-1">
                            {tos.map(t => {
                              const rev = Number(t.revenue) || 0;
                              return (
                                <div key={t.id} className="flex items-center justify-between text-sm py-1 pl-1">
                                  <span className="flex items-center gap-2 text-gray-600">
                                    {t.is_paid_by_client ? (
                                      <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                                    ) : (
                                      <AlertCircle size={13} className="text-amber-500 shrink-0" />
                                    )}
                                    <span>{format(parseISO(t.date), 'dd/MM/yyyy')}</span>
                                  </span>
                                  <span className={cn(
                                    'font-semibold',
                                    t.is_paid_by_client ? 'text-emerald-600' : 'text-amber-600'
                                  )}>
                                    {formatMAD(rev)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Client footer total */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">TOTAL</span>
                    <span className="text-lg font-bold text-accent-dark">{formatMAD(client.total)}</span>
                  </div>
                  {client.unpaid > 0 && client.paid > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle size={10} /> {formatMAD(client.paid)}
                        </span>
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertCircle size={10} /> {formatMAD(client.unpaid)}
                        </span>
                      </div>
                      <div className="w-16 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.round((client.paid / client.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 2: NOUVELLE FACTURE (invoice template form)
   ═══════════════════════════════════════════════ */
function NouvelleFactureTab() {
  // Client list from Supabase
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);

  // Form state
  const [invoiceNum, setInvoiceNum] = useState(generateInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [clientName, setClientName] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([makeEmptyLine()]);
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load clients on mount
  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient();
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      setClientOptions((data || []) as ClientOption[]);
    }
    fetchClients();
  }, []);

  // Line management
  const addLine = useCallback(() => {
    setLines(prev => [...prev, makeEmptyLine()]);
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
  }, []);

  const updateLine = useCallback((id: string, field: keyof InvoiceLine, value: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  // Computed total
  const total = useMemo(() => {
    return lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  }, [lines]);

  // Generate formatted invoice text for WhatsApp
  const invoiceText = useMemo(() => {
    const dateFmt = format(parseISO(invoiceDate), 'd MMMM yyyy', { locale: fr });

    let text = `📄 FACTURE SPOTLESS\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `N°: ${invoiceNum}\n`;
    text += `Date: ${dateFmt}\n`;
    text += `Client: ${clientName || '—'}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📋 Détails des prestations:\n\n`;

    for (const line of lines) {
      const amt = parseFloat(line.amount) || 0;
      if (!line.description && amt === 0) continue;
      const lineDateFmt = line.date ? format(parseISO(line.date), 'dd/MM/yyyy') : '';
      text += `  📍 ${lineDateFmt}`;
      if (line.description) text += ` — ${line.description}`;
      text += `\n     💰 ${amt} MAD\n\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 TOTAL: ${total} MAD\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (notes.trim()) {
      text += `\n📝 ${notes.trim()}\n`;
    }

    text += `\nMerci pour votre confiance !\nSPOTLESS — Rien ne nous échappe 🧹✨`;
    return text;
  }, [invoiceNum, invoiceDate, clientName, lines, total, notes]);

  async function handleCopy() {
    await copyToClipboard(invoiceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleReset() {
    setInvoiceNum(generateInvoiceNumber());
    setInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
    setClientName('');
    setLines([makeEmptyLine()]);
    setNotes('');
    setShowPreview(false);
  }

  return (
    <div className="space-y-4">
      {/* ── Invoice header fields ── */}
      <Card>
        <div className="space-y-3">
          {/* Row: Invoice # and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Hash size={10} /> N° Facture
              </label>
              <input
                type="text"
                value={invoiceNum}
                onChange={e => setInvoiceNum(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={10} /> Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Users size={10} /> Client
            </label>
            <div className="relative">
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Nom du client..."
                list="client-datalist"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <datalist id="client-datalist">
                {clientOptions.map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Service lines ── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Prestations</h3>
          <button
            onClick={addLine}
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-dark transition cursor-pointer"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line.id} className="bg-gray-50 rounded-lg p-3 space-y-2 relative group">
              {/* Line number badge */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Ligne {idx + 1}</span>
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(line.id)}
                    className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Date & description */}
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <input
                  type="date"
                  value={line.date}
                  onChange={e => updateLine(line.id, 'date', e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
                <input
                  type="text"
                  value={line.description}
                  onChange={e => updateLine(line.id, 'description', e.target.value)}
                  placeholder="Description (appart, service...)"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              {/* Amount */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={line.amount}
                    onChange={e => updateLine(line.id, 'amount', e.target.value)}
                    placeholder="Montant"
                    min="0"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-14 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent font-semibold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">MAD</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total bar */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">TOTAL</span>
          <span className="text-xl font-bold text-accent-dark">{total} MAD</span>
        </div>
      </Card>

      {/* ── Notes ── */}
      <Card>
        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
          Notes (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ex: Payable sous 7 jours, virement bancaire..."
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
        />
      </Card>

      {/* ── Preview toggle ── */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition cursor-pointer border',
          showPreview
            ? 'bg-accent-bg text-accent-dark border-accent/20'
            : 'bg-white text-gray-600 border-gray-200 hover:border-accent/30'
        )}
      >
        <Eye size={16} />
        {showPreview ? 'Masquer l\'aperçu' : 'Voir l\'aperçu'}
      </button>

      {/* ── Preview ── */}
      {showPreview && (
        <Card className="bg-gray-50 border-accent/20">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Aperçu WhatsApp</div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed bg-white rounded-lg p-4 border border-gray-100 overflow-x-auto">
            {invoiceText}
          </pre>
        </Card>
      )}

      {/* ── Action buttons ── */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          disabled={!clientName.trim() || total === 0}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition cursor-pointer',
            copied
              ? 'bg-emerald-500 text-white'
              : !clientName.trim() || total === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]'
          )}
        >
          {copied ? (
            <><Check size={18} /> Copié !</>
          ) : (
            <><Copy size={18} /> Copier la facture</>
          )}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
          title="Réinitialiser"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
