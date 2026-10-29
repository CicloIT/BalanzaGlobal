import React from 'react';
import { cx } from '../../lib/cx';
import Spinner from './Spinner';

const VARIANTES = {
  primary: 'bg-brand-solid text-white hover:bg-brand-solid-hover border-transparent shadow-card',
  secondary: 'bg-surface text-fg border-line-strong hover:bg-surface-3',
  ghost: 'bg-transparent text-fg-muted border-transparent hover:bg-surface-3 hover:text-fg',
  danger: 'bg-danger-solid text-white border-transparent hover:brightness-95 shadow-card',
  'danger-soft': 'bg-danger-soft text-danger border-transparent hover:brightness-95',
  success: 'bg-success-solid text-white border-transparent hover:brightness-95 shadow-card',
  salida: 'bg-salida-solid text-white border-transparent hover:brightness-95 shadow-card',
  soft: 'bg-brand-soft text-brand border-transparent hover:brightness-95',
};

const TAMANOS = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-base gap-2 rounded-lg',
  xl: 'h-14 px-6 text-base gap-2.5 rounded-xl',
  icon: 'h-9 w-9 justify-center rounded-lg',
  'icon-sm': 'h-8 w-8 justify-center rounded-md',
};

// Botón base. `as` permite renderizarlo como <a> o <label> (p. ej. subir archivo)
// manteniendo el mismo estilo. `loading` deshabilita y muestra un spinner.
const Button = React.forwardRef(function Button({
  as: Tag = 'button',
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  className,
  children,
  type,
  ...props
}, ref) {
  const inactivo = disabled || loading;
  const iconSize = size === 'sm' || size === 'icon-sm' ? 14 : size === 'lg' || size === 'xl' ? 20 : 16;
  return (
    <Tag
      ref={ref}
      type={Tag === 'button' ? (type ?? 'button') : type}
      disabled={Tag === 'button' ? inactivo : undefined}
      aria-disabled={Tag !== 'button' && inactivo ? true : undefined}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center font-semibold border transition-colors duration-150 select-none whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        Tag !== 'button' && inactivo && 'opacity-50 pointer-events-none',
        // relative: contiene el <input type=file> oculto (sr-only es absolute)
        Tag === 'label' && 'relative cursor-pointer',
        VARIANTES[variant], TAMANOS[size], className
      )}
      {...props}
    >
      {loading ? <Spinner size={iconSize} /> : Icon && <Icon size={iconSize} aria-hidden="true" className="shrink-0" />}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden="true" className="shrink-0" />}
    </Tag>
  );
});

export default Button;
