import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cx } from '../../lib/cx';

const TONOS = {
  info: { cls: 'bg-info-soft text-info border-info/25', Icon: Info },
  success: { cls: 'bg-success-soft text-success border-success/25', Icon: CheckCircle2 },
  warning: { cls: 'bg-warning-soft text-warning border-warning/25', Icon: AlertTriangle },
  danger: { cls: 'bg-danger-soft text-danger border-danger/25', Icon: AlertCircle },
};

export default function Alert({ tone = 'info', title, icon, onClose, className, children }) {
  const { cls, Icon } = TONOS[tone];
  const Icono = icon ?? Icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-fade-in', cls, className)}
    >
      <Icono size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5 text-fg-muted [&_strong]:text-fg', !title && 'font-medium')}>{children}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="p-0.5 rounded opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
