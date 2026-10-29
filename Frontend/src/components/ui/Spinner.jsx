import React from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/cx';

export default function Spinner({ size = 16, className }) {
  return <Loader2 size={size} aria-hidden="true" className={cx('animate-spin shrink-0', className)} />;
}

// Bloque de carga para una sección o tabla
export function LoadingState({ texto = 'Cargando...', className }) {
  return (
    <div role="status" className={cx('flex items-center justify-center gap-3 py-16 text-sm text-fg-muted', className)}>
      <Spinner size={20} className="text-brand" />
      {texto}
    </div>
  );
}
