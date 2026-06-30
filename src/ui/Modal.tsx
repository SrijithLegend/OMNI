import { cn } from '@/utils';
import { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      contentRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl bg-white shadow-2xl overflow-hidden animate-slide-up',
          sizeClasses[size]
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-2">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-omni-900">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="mt-1 text-sm text-omni-500">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded-lg p-1 text-omni-400 hover:bg-omni-100 hover:text-omni-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-omni-400"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-omni-100 bg-omni-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
