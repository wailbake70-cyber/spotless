'use client';

import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-lg border border-border px-3 py-2 text-sm font-body text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
          'transition-colors duration-200',
          error && 'border-red-300 focus:ring-red-200 focus:border-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'w-full rounded-lg border border-border px-3 py-2 text-sm font-body text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
          'transition-colors duration-200 min-h-[80px] resize-y',
          error && 'border-red-300 focus:ring-red-200 focus:border-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
