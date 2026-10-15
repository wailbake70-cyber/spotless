import { cn } from '@/lib/utils';
import { TURNOVER_STATUSES, type TurnoverStatus } from '@/lib/constants';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'gold' | 'success' | 'warning' | 'error';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variant === 'default' && 'bg-gray-100 text-gray-700',
        variant === 'gold' && 'bg-brand-gold/10 text-brand-gold-dark',
        variant === 'success' && 'bg-green-50 text-green-700',
        variant === 'warning' && 'bg-yellow-50 text-yellow-700',
        variant === 'error' && 'bg-red-50 text-red-700',
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TurnoverStatus }) {
  const config = TURNOVER_STATUSES[status];
  if (!config) return null;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', config.color, config.textColor)}>
      {config.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-brand-gold/10 text-brand-gold-dark border border-brand-gold/20">
      {type}
    </span>
  );
}
