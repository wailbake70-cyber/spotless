'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, Sparkles, LogOut, LogIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/client';
import { formatTime, cn } from '@/lib/utils';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addMonths, subMonths, addDays, subDays,
  eachDayOfInterval, format, isToday, isSameDay, isSameMonth,
  parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Turnover } from '@/lib/supabase/types';

type MainTab = 'aujourdhui' | 'semaine' | 'toutes';
type SubFilter = 'a_venir' | 'passes' | 'toutes';

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'aujourdhui', label: "Aujourd'hui" },
  { key: 'semaine', label: 'Cette semaine' },
  { key: 'toutes', label: 'Toutes' },
];

const SUB_FILTERS: { key: SubFilter; label: string }[] = [
  { key: 'a_venir', label: 'À venir' },
  { key: 'passes', label: 'Passées' },
  { key: 'toutes', label: 'Toutes' },
];

export default function TurnoversPage() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<Turnover[]>([]);
  const [mainTab, setMainTab] = useState<MainTab>('aujourdhui');
  const [subFilter, setSubFilter] = useState<SubFilter>('a_venir');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTurnovers = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const today = new Date();
      let startDate: Date;
      let endDate: Date;

      if (mainTab === 'aujourdhui') {
        startDate = today;
        endDate = today;
      } else if (mainTab === 'semaine') {
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
      } else {
        startDate = subDays(today, 90);
        endDate = addDays(today, 90);
      }

      const { data } = await supabase
        .from('turnovers')
        .select('*, apartment:apartments(*, client:clients(*)), cleaner:cleaners(*)')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date')
        .order('time_start');

      setTurnovers((data as Turnover[]) || []);
    } catch (e) {
      console.error('Error loading turnovers:', e);
    } finally {
      setLoading(false);
    }
  }, [mainTab]);

  useEffect(() => {
    loadTurnovers();
  }, [loadTurnovers]);

  // Clear selected date when switching tabs
  function handleTabChange(tab: MainTab) {
    setMainTab(tab);
    setSelectedDate(null);
    if (tab !== 'toutes') setSubFilter('a_venir');
  }

  // Filtered turnovers
  const filtered = useMemo(() => {
    let result = turnovers;

    // Calendar date selection overrides everything
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return result.filter(t => t.date === dateStr);
    }

    // Sub-filter for "toutes" tab
    if (mainTab === 'toutes' && subFilter !== 'toutes') {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (subFilter === 'a_venir') {
        result = result.filter(t => t.date >= todayStr);
      } else {
        result = result.filter(t => t.date < todayStr).reverse();
      }
    }

    return result;
  }, [turnovers, selectedDate, mainTab, subFilter]);

  // Group by date for list headers
  const groupedByDate = useMemo(() => {
    const map: Record<string, Turnover[]> = {};
    for (const t of filtered) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [filtered]);

  // Turnovers per date for calendar dots
  const turnoversPerDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of turnovers) {
      map[t.date] = (map[t.date] || 0) + 1;
    }
    return map;
  }, [turnovers]);

  const missionCount = filtered.length;
  const sortedDates = Object.keys(groupedByDate).sort(
    mainTab === 'toutes' && subFilter === 'passes' ? (a, b) => b.localeCompare(a) : undefined
  );

  const selectedDateLabel = selectedDate
    ? format(selectedDate, "EEEE d MMMM", { locale: fr })
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto pb-28 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Missions</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={cn(
              'p-2 rounded-xl transition-all duration-200 cursor-pointer',
              showCalendar
                ? 'bg-accent-dark text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-accent/30 hover:text-accent-dark'
            )}
          >
            <CalendarIcon size={20} />
          </button>
          <Button onClick={() => router.push('/turnovers/nouveau')} size="sm">
            <Plus size={18} />
            <span className="hidden sm:inline ml-1">Nouveau</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {MAIN_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer',
              mainTab === tab.key
                ? 'bg-white text-accent-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar (collapsible) */}
      {showCalendar && (
        <MiniCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          turnoversPerDate={turnoversPerDate}
          selectedDate={selectedDate}
          onSelectDate={(d) => {
            setSelectedDate(d);
            if (d && mainTab !== 'toutes') {
              setMainTab('toutes');
            }
          }}
        />
      )}

      {/* Selected date indicator */}
      {selectedDate && (
        <div className="flex items-center justify-between bg-accent-bg rounded-xl px-4 py-2.5 border border-accent/10">
          <span className="text-sm font-medium text-accent-dark capitalize">{selectedDateLabel}</span>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-xs text-accent-dark hover:underline cursor-pointer font-medium"
          >
            Effacer
          </button>
        </div>
      )}

      {/* Sub-filters for "Toutes" tab */}
      {mainTab === 'toutes' && !selectedDate && (
        <div className="flex gap-2">
          {SUB_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setSubFilter(f.key)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer',
                subFilter === f.key
                  ? 'bg-accent-dark text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-accent/30'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : missionCount === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} />}
          title={
            mainTab === 'aujourdhui'
              ? "Aucune mission aujourd'hui"
              : selectedDate
                ? 'Aucune mission ce jour'
                : mainTab === 'semaine'
                  ? 'Aucune mission cette semaine'
                  : subFilter === 'a_venir'
                    ? 'Aucune mission à venir'
                    : subFilter === 'passes'
                      ? 'Aucune mission passée'
                      : 'Aucune mission'
          }
          description={
            mainTab === 'aujourdhui'
              ? 'Profitez de votre journée !'
              : 'Planifiez vos prochaines missions'
          }
          action={
            <Button onClick={() => router.push('/turnovers/nouveau')}>
              <Plus size={16} /> Nouvelle mission
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Count */}
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">
            {missionCount} mission{missionCount !== 1 ? 's' : ''}
          </p>

          {/* Grouped by date */}
          {sortedDates.map(dateStr => (
            <div key={dateStr} className="space-y-2">
              {/* Date header — show when multiple dates */}
              {sortedDates.length > 1 && (
                <DateHeader dateStr={dateStr} />
              )}
              {groupedByDate[dateStr].map(t => (
                <MissionCard
                  key={t.id}
                  turnover={t}
                  onClick={() => router.push(`/turnovers/${t.id}`)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Date Header ────────────────────────────────────────
function DateHeader({ dateStr }: { dateStr: string }) {
  const date = parseISO(dateStr);
  const today = isToday(date);
  const label = today
    ? "Aujourd'hui"
    : format(date, 'EEEE d MMMM', { locale: fr });

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        today ? 'bg-accent-dark text-white' : 'bg-gray-100 text-gray-600'
      )}>
        {format(date, 'd')}
      </div>
      <span className={cn(
        'text-sm font-semibold capitalize',
        today ? 'text-accent-dark' : 'text-gray-600'
      )}>
        {label}
      </span>
    </div>
  );
}

// ─── Mini Calendar ──────────────────────────────────────
function MiniCalendar({
  month, onMonthChange, turnoversPerDate, selectedDate, onSelectDate
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  turnoversPerDate: Record<string, number>;
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
}) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const calStart = startOfWeek(start, { weekStartsOn: 1 });
  const calEnd = endOfWeek(end, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-text-primary capitalize">
            {format(month, 'MMMM yyyy', { locale: fr })}
          </span>
          {!isSameMonth(month, new Date()) && (
            <button
              onClick={() => onMonthChange(new Date())}
              className="text-[10px] font-medium text-accent-dark bg-accent-bg px-2 py-0.5 rounded-full cursor-pointer hover:bg-accent-dark hover:text-white transition-colors"
            >
              Auj.
            </button>
          )}
        </div>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronRight size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 px-3 border-t border-gray-50">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const count = turnoversPerDate[dateStr] || 0;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(selected ? null : day)}
              className={cn(
                'relative flex flex-col items-center py-1 rounded-lg transition-all duration-150 cursor-pointer',
                !inMonth && 'opacity-25',
                selected && 'bg-accent-dark',
                !selected && today && 'bg-accent-bg',
                !selected && !today && inMonth && 'hover:bg-gray-50'
              )}
            >
              <span className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full text-xs',
                selected
                  ? 'text-white font-bold'
                  : today
                    ? 'text-accent-dark font-bold'
                    : 'text-gray-700 font-medium'
              )}>
                {format(day, 'd')}
              </span>
              {count > 0 && inMonth && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-1 h-1 rounded-full',
                        selected ? 'bg-white/80' : 'bg-accent-dark'
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mission Card ───────────────────────────────────────
const STATUS_CONFIG = {
  planifie: { dot: 'bg-gray-400', text: 'text-gray-600', label: 'Planifiée', border: 'border-l-amber-400' },
  assigne: { dot: 'bg-green-500', text: 'text-green-700', label: 'Assignée', border: 'border-l-green-400' },
  en_cours: { dot: 'bg-blue-500', text: 'text-blue-700', label: 'En cours', border: 'border-l-blue-400' },
  termine: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Terminée', border: 'border-l-emerald-500' },
  verifie: { dot: 'bg-teal-500', text: 'text-teal-700', label: 'Vérifiée', border: 'border-l-teal-500' },
  annule: { dot: 'bg-red-400', text: 'text-red-600', label: 'Annulée', border: 'border-l-red-400' },
} as const;

function MissionCard({ turnover, onClick }: { turnover: Turnover; onClick: () => void }) {
  const sc = STATUS_CONFIG[turnover.status] || STATUS_CONFIG.planifie;

  // Calculate duration from time_start and time_end
  let duration = '';
  if (turnover.time_start && turnover.time_end) {
    const [sh, sm] = turnover.time_start.split(':').map(Number);
    const [eh, em] = turnover.time_end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      duration = m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
    }
  }

  // Format guest_checkin date
  let checkinLabel = '';
  if (turnover.guest_checkin) {
    try {
      checkinLabel = format(parseISO(turnover.guest_checkin), "EEE d MMM", { locale: fr });
    } catch {
      checkinLabel = turnover.guest_checkin;
    }
  }

  // Format guest_checkout date
  let checkoutLabel = '';
  if (turnover.guest_checkout) {
    try {
      checkoutLabel = format(parseISO(turnover.guest_checkout), "EEE d MMM", { locale: fr });
    } catch {
      checkoutLabel = turnover.guest_checkout;
    }
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-gray-100 shadow-sm',
        'border-l-[4px]', sc.border,
        'hover:shadow-md hover:border-gray-200 transition-all duration-200 cursor-pointer',
        'flex items-center'
      )}
    >
      {/* Content */}
      <div className="flex-1 min-w-0 p-4 space-y-2">
        {/* Row 1: Apartment name + Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-text-primary truncate text-[15px]">
            {turnover.apartment?.name || 'Appartement'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wide shrink-0">
            🧹 Ménage
          </span>
        </div>

        {/* Row 2: Cleaner name */}
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          {turnover.cleaner ? (
            <>
              <Sparkles size={13} className="text-accent-dark shrink-0" />
              <span className="font-medium">{turnover.cleaner.name}</span>
            </>
          ) : (
            <span className="text-gray-400 italic text-xs">Non assignée</span>
          )}
        </div>

        {/* Row 3: Time info */}
        {(turnover.time_start || duration) && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {turnover.time_start && (
              <span className="flex items-center gap-1">
                <Clock size={12} className="shrink-0" />
                {formatTime(turnover.time_start)}
              </span>
            )}
            {duration && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-medium text-gray-600">{duration}</span>
              </>
            )}
            {turnover.checkin_time && (
              <>
                <span className="text-gray-300">·</span>
                <span>Check-in {formatTime(turnover.checkin_time)}</span>
              </>
            )}
          </div>
        )}

        {/* Row 4: Guest checkout / checkin info */}
        {(checkoutLabel || checkinLabel) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {checkoutLabel && (
              <span className="flex items-center gap-1">
                <LogOut size={11} className="shrink-0 text-gray-400" />
                <span>Départ <span className="capitalize">{checkoutLabel}</span></span>
              </span>
            )}
            {checkinLabel && (
              <span className="flex items-center gap-1">
                <LogIn size={11} className="shrink-0 text-gray-400" />
                <span>Arrivée <span className="capitalize">{checkinLabel}</span></span>
              </span>
            )}
          </div>
        )}

        {/* Row 5: Status */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', sc.dot)} />
          <span className={cn('text-xs font-semibold', sc.text)}>{sc.label}</span>
        </div>
      </div>

      {/* Right chevron */}
      <div className="pr-3 shrink-0">
        <ChevronRight size={18} className="text-gray-300" />
      </div>
    </div>
  );
}
