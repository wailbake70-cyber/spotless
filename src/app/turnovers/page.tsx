'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  List, LayoutGrid, Clock, Filter
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, TypeBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/client';
import {
  formatDay, formatTime, formatMAD, formatWeekDay, formatDayNum,
  formatMonthYear, formatDateShort, cn
} from '@/lib/utils';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, subWeeks, addMonths, subMonths, addDays, subDays,
  eachDayOfInterval, format, isToday, isSameDay, parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Turnover } from '@/lib/supabase/types';

type ViewMode = 'semaine' | 'mois' | 'jour' | 'liste';

export default function TurnoversPage() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<Turnover[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('semaine');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTurnovers();
  }, [currentDate, view]);

  async function loadTurnovers() {
    const supabase = createClient();
    let start: Date;
    let end: Date;

    if (view === 'semaine') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (view === 'mois') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    } else if (view === 'jour') {
      start = currentDate;
      end = currentDate;
    } else {
      // liste: show last 30 days + next 14
      start = subDays(new Date(), 30);
      end = addDays(new Date(), 14);
    }

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('turnovers')
      .select('*, apartment:apartments(*, client:clients(*)), cleaner:cleaners(*)')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date')
      .order('time_start');

    setTurnovers((data as Turnover[]) || []);
    setLoading(false);
  }

  function navigate(direction: 'prev' | 'next') {
    if (view === 'semaine') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else if (view === 'mois') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else if (view === 'jour') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    }
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  const filtered = useMemo(() => {
    if (!statusFilter) return turnovers;
    return turnovers.filter(t => t.status === statusFilter);
  }, [turnovers, statusFilter]);

  // Group turnovers by date
  const groupedByDate = useMemo(() => {
    const map: Record<string, Turnover[]> = {};
    for (const t of filtered) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [filtered]);

  const VIEWS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'semaine', label: 'Sem.', icon: <LayoutGrid size={14} /> },
    { key: 'mois', label: 'Mois', icon: <CalendarIcon size={14} /> },
    { key: 'jour', label: 'Jour', icon: <Clock size={14} /> },
    { key: 'liste', label: 'Liste', icon: <List size={14} /> },
  ];

  const headerTitle = useMemo(() => {
    if (view === 'jour') return formatDay(currentDate);
    if (view === 'mois') return formatMonthYear(currentDate);
    if (view === 'semaine') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`;
    }
    return 'Tous les turnovers';
  }, [currentDate, view]);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Turnovers</h1>
        <Button onClick={() => router.push('/turnovers/nouveau')}>
          <Plus size={18} />
          <span className="hidden sm:inline">Nouveau</span>
        </Button>
      </div>

      {/* View Selector */}
      <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-100">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
              view === v.key
                ? 'bg-accent-dark text-white'
                : 'text-gray-500 hover:text-text-primary'
            )}
          >
            {v.icon}
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Navigation Bar */}
      {view !== 'liste' && (
        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
          <button
            onClick={() => navigate('prev')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary text-sm capitalize">{headerTitle}</span>
            {!isToday(currentDate) && (
              <button
                onClick={goToToday}
                className="text-xs text-accent-dark hover:underline cursor-pointer"
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('next')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer',
            !statusFilter ? 'bg-text-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          Tous
        </button>
        {(['planifie', 'assigne', 'en_cours', 'termine', 'verifie', 'annule'] as const).map(s => {
          const count = turnovers.filter(t => t.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer',
                statusFilter === s ? 'bg-text-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {s === 'planifie' ? 'Planifié' : s === 'assigne' ? 'Assigné' : s === 'en_cours' ? 'En cours' : s === 'termine' ? 'Terminé' : s === 'verifie' ? 'Vérifié' : 'Annulé'} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Week View */}
          {view === 'semaine' && (
            <WeekView
              currentDate={currentDate}
              groupedByDate={groupedByDate}
              onDayClick={(d) => { setCurrentDate(d); setView('jour'); }}
              onTurnoverClick={(id) => router.push(`/turnovers/${id}`)}
            />
          )}

          {/* Month View */}
          {view === 'mois' && (
            <MonthView
              currentDate={currentDate}
              groupedByDate={groupedByDate}
              onDayClick={(d) => { setCurrentDate(d); setView('jour'); }}
            />
          )}

          {/* Day View */}
          {view === 'jour' && (
            <DayView
              turnovers={filtered}
              date={currentDate}
              onTurnoverClick={(id) => router.push(`/turnovers/${id}`)}
            />
          )}

          {/* List View */}
          {view === 'liste' && (
            <ListView
              groupedByDate={groupedByDate}
              onTurnoverClick={(id) => router.push(`/turnovers/${id}`)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────
function WeekView({
  currentDate, groupedByDate, onDayClick, onTurnoverClick
}: {
  currentDate: Date;
  groupedByDate: Record<string, Turnover[]>;
  onDayClick: (d: Date) => void;
  onTurnoverClick: (id: string) => void;
}) {
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: endOfWeek(currentDate, { weekStartsOn: 1 }) });

  return (
    <div className="space-y-2">
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayTurnovers = groupedByDate[dateStr] || [];
        const today = isToday(day);

        return (
          <div key={dateStr}>
            <button
              onClick={() => onDayClick(day)}
              className={cn(
                'flex items-center gap-3 w-full text-left mb-1.5 px-2 py-1 rounded-lg transition-colors cursor-pointer',
                today ? 'bg-accent-bg' : 'hover:bg-gray-50'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex flex-col items-center justify-center text-xs leading-tight',
                today ? 'bg-accent-dark text-white font-bold' : 'bg-gray-100 text-gray-600'
              )}>
                <span className="uppercase text-[10px]">{formatWeekDay(day)}</span>
                <span className="font-semibold">{formatDayNum(day)}</span>
              </div>
              <span className="text-sm text-gray-500">
                {dayTurnovers.length} turnover{dayTurnovers.length !== 1 ? 's' : ''}
              </span>
            </button>

            {dayTurnovers.length > 0 && (
              <div className="space-y-2 ml-2 pl-4 border-l-2 border-gray-100">
                {dayTurnovers.map(t => (
                  <TurnoverCard key={t.id} turnover={t} onClick={() => onTurnoverClick(t.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────
function MonthView({
  currentDate, groupedByDate, onDayClick
}: {
  currentDate: Date;
  groupedByDate: Record<string, Turnover[]>;
  onDayClick: (d: Date) => void;
}) {
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const monthStart = startOfWeek(start, { weekStartsOn: 1 });
  const monthEnd = endOfWeek(end, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTurnovers = groupedByDate[dateStr] || [];
          const inMonth = day.getMonth() === currentDate.getMonth();
          const today = isToday(day);

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative min-h-[60px] sm:min-h-[80px] p-1 border-b border-r border-gray-50 transition-colors cursor-pointer',
                !inMonth && 'opacity-40',
                today && 'bg-accent-bg',
                'hover:bg-gray-50'
              )}
            >
              <span className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs',
                today ? 'bg-accent-dark text-white font-bold' : 'text-gray-700'
              )}>
                {formatDayNum(day)}
              </span>
              {dayTurnovers.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayTurnovers.slice(0, 3).map(t => (
                    <div
                      key={t.id}
                      className={cn(
                        'h-1.5 rounded-full',
                        t.status === 'planifie' ? 'bg-status-planifie' :
                        t.status === 'assigne' ? 'bg-status-assigne' :
                        t.status === 'en_cours' ? 'bg-status-en-cours' :
                        t.status === 'termine' ? 'bg-status-termine' :
                        t.status === 'verifie' ? 'bg-status-verifie' :
                        'bg-status-annule'
                      )}
                    />
                  ))}
                  {dayTurnovers.length > 3 && (
                    <span className="text-[9px] text-gray-400">+{dayTurnovers.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ────────────────────────────────────────────
function DayView({
  turnovers, date, onTurnoverClick
}: {
  turnovers: Turnover[];
  date: Date;
  onTurnoverClick: (id: string) => void;
}) {
  if (turnovers.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon size={48} />}
        title="Aucune mission"
        description={`Pas de mission prévue pour ${formatDay(date).toLowerCase()}`}
      />
    );
  }

  return (
    <div className="space-y-2">
      {turnovers.map(t => (
        <TurnoverCard key={t.id} turnover={t} onClick={() => onTurnoverClick(t.id)} expanded />
      ))}
    </div>
  );
}

// ─── List View ───────────────────────────────────────────
function ListView({
  groupedByDate, onTurnoverClick
}: {
  groupedByDate: Record<string, Turnover[]>;
  onTurnoverClick: (id: string) => void;
}) {
  const sortedDates = Object.keys(groupedByDate).sort();

  if (sortedDates.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon size={48} />}
        title="Aucune mission"
        description="Aucune mission trouvée pour cette période"
      />
    );
  }

  return (
    <div className="space-y-4">
      {sortedDates.map(date => (
        <section key={date}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 capitalize">
            {formatDay(date)}
          </h3>
          <div className="space-y-2">
            {groupedByDate[date].map(t => (
              <TurnoverCard key={t.id} turnover={t} onClick={() => onTurnoverClick(t.id)} expanded />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Turnover Card ───────────────────────────────────────
function TurnoverCard({
  turnover, onClick, expanded
}: {
  turnover: Turnover;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-text-primary truncate">
              {turnover.apartment?.name || 'Appartement'}
            </span>
            <StatusBadge status={turnover.status} />
          </div>
          <p className="text-sm text-gray-500 truncate">
            {turnover.apartment?.client?.name || 'Client'}
            {turnover.cleaner && ` · ${turnover.cleaner.name}`}
          </p>
          {expanded && (
            <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
              {turnover.time_start && (
                <span className="flex items-center gap-1">
                  <Clock size={13} /> {formatTime(turnover.time_start)}
                </span>
              )}
              {turnover.apartment?.neighborhood && (
                <span>{turnover.apartment.neighborhood}</span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="font-semibold text-accent-dark">{formatMAD(Number(turnover.revenue))}</div>
          {!expanded && turnover.time_start && (
            <div className="text-xs text-gray-400">{formatTime(turnover.time_start)}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
