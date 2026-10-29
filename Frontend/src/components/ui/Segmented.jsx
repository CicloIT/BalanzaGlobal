import React from 'react';
import { cx } from '../../lib/cx';

// Grupo de opciones excluyentes (filtros rápidos). options: [{ value, label, tone? }]
export default function Segmented({ label, options, value, onChange, size = 'sm', className }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      {label && <span className="text-xs font-medium text-fg-subtle">{label}</span>}
      <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-line bg-surface-2 p-0.5">
        {options.map((op) => {
          const activo = op.value === value;
          return (
            <button
              key={String(op.value)}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(op.value)}
              className={cx(
                'rounded-md font-medium transition-colors',
                size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
                activo
                  ? cx('bg-surface text-fg shadow-card', op.activeClass)
                  : 'text-fg-muted hover:text-fg'
              )}
            >
              {op.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
