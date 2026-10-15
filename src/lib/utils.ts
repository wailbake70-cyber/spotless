import { format, formatRelative, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// Currency formatting
export function formatMAD(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (Number.isInteger(amount)) return `${amount} MAD`;
  return `${amount.toFixed(2)} MAD`;
}

// Date formatting
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMMM yyyy', { locale: fr });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM', { locale: fr });
}

export function formatDay(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return "Aujourd'hui";
  if (isTomorrow(d)) return 'Demain';
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return '—';
  return time.slice(0, 5); // "14:30:00" → "14:30"
}

export function formatWeekDay(date: Date): string {
  return format(date, 'EEE', { locale: fr });
}

export function formatDayNum(date: Date): string {
  return format(date, 'd');
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: fr });
}

// Margin calculation
export function calcMargin(
  revenue: number | null,
  costFemme: number | null,
  costTransport: number | null,
  costProduits: number | null,
  costPressing: number | null,
  costOther: number | null
): number {
  return (revenue || 0) - (costFemme || 0) - (costTransport || 0)
    - (costProduits || 0) - (costPressing || 0) - (costOther || 0);
}

export function calcMarginPct(margin: number, revenue: number | null): number {
  if (!revenue || revenue === 0) return 0;
  return Math.round((margin / revenue) * 100);
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Phone formatting
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  return phone;
}

// Capitalize first letter
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// cn utility for conditional classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
