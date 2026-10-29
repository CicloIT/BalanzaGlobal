import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';

const ANCHOS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' };

// Ventana modal: cierra con Escape o clic afuera, lleva el foco adentro y lo
// devuelve al cerrar. En pantallas chicas ocupa casi todo el alto.
export default function Modal({
  open = true, onClose, title, subtitle, icon: Icon, size = 'md',
  footer, children, className, bodyClassName, closeOnOverlay = true,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  // onClose suele venir inline: se guarda en un ref para no reiniciar el foco en cada render
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    document.addEventListener('keydown', onKey);
    const foco = panelRef.current?.querySelector('[data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea');
    (foco ?? panelRef.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-overlay animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full flex flex-col bg-surface border border-line shadow-pop animate-pop-in',
          'max-h-[92vh] rounded-t-2xl sm:rounded-xl focus:outline-none',
          ANCHOS[size], className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
            <div className="flex items-start gap-3 min-w-0">
              {Icon && (
                <div className="p-2 rounded-lg bg-brand-soft text-brand shrink-0">
                  <Icon size={18} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                {title && <h2 id={titleId} className="text-base font-semibold text-fg leading-tight">{title}</h2>}
                {subtitle && <p className="mt-0.5 text-sm text-fg-subtle truncate">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="p-1.5 -m-1 rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className={cx('flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-line bg-surface-2 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
