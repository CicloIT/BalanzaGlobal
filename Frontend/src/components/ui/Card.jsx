import React from 'react';
import { cx } from '../../lib/cx';

export function Card({ as: Tag = 'section', className, children, ...props }) {
  return (
    <Tag className={cx('bg-surface border border-line rounded-xl shadow-card', className)} {...props}>
      {children}
    </Tag>
  );
}

// Encabezado de tarjeta: icono + título + descripción a la izquierda, acciones a la derecha
export function CardHeader({ icon: Icon, title, description, actions, className, tone = 'brand' }) {
  const tonos = {
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-3 text-fg-muted',
  };
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-line', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className={cx('p-2 rounded-lg shrink-0', tonos[tone])}>
            <Icon size={18} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-fg-subtle">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx('p-5', className)}>{children}</div>;
}
