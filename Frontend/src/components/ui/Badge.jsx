import React from 'react';
import { cx } from '../../lib/cx';

const TONOS = {
  neutral: 'bg-surface-3 text-fg-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  ingreso: 'bg-ingreso-soft text-ingreso',
  salida: 'bg-salida-soft text-salida',
};

// Etiqueta de estado. Siempre lleva texto (y opcionalmente icono): nunca depende solo del color.
export default function Badge({ tone = 'neutral', icon: Icon, dot = false, size = 'md', className, children }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1 font-semibold rounded-md whitespace-nowrap',
      size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
      TONOS[tone], className
    )}>
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
