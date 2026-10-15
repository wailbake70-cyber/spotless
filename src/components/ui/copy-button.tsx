'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard, cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
        copied
          ? 'bg-green-50 text-green-600'
          : 'bg-bg-hover text-text-secondary hover:bg-accent-bg hover:text-accent-dark',
        className
      )}
      title={`Copier ${label || text}`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label || text}
    </button>
  );
}
