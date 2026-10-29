import React from 'react';
import { cx } from '../../lib/cx';

// Título de pantalla con descripción breve y acciones principales a la derecha
export default function PageHeader({ title, description, meta, actions, className }) {
  return (
    <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-subtle">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
