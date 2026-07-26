import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared modal shell: a bottom sheet on mobile, a centred panel from `sm` up.
 * Closes on backdrop click and on Escape — both matter on a phone, where the
 * close affordance is easy to miss.
 */
export function Modal({ isOpen, onClose, title, icon, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-marine-950/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-marine-900 border-t sm:border border-brass-500/25 w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-brass-500/15 flex justify-between items-center gap-3">
          <h2 className="text-base font-medium text-ink flex items-center gap-2.5 min-w-0">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center text-ink-mute hover:text-brass-400 transition-colors duration-150 shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
