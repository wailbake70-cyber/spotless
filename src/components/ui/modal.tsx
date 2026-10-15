'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'fixed inset-0 z-50 m-auto rounded-xl border-0 bg-white p-0 shadow-xl backdrop:bg-black/50',
        'max-h-[90vh] overflow-y-auto',
        size === 'sm' && 'w-full max-w-sm',
        size === 'md' && 'w-full max-w-lg',
        size === 'lg' && 'w-full max-w-2xl',
      )}
      onClose={onClose}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 z-10">
        <h2 className="font-heading text-lg font-semibold text-brand-black">{title}</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-5">
        {children}
      </div>
    </dialog>
  );
}
