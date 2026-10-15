'use client';

import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-body font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-accent-dark text-white hover:bg-accent active:bg-accent-dark/90',
        variant === 'secondary' && 'bg-white text-text-primary border border-border hover:border-accent hover:bg-bg-hover',
        variant === 'ghost' && 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
        variant === 'danger' && 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
