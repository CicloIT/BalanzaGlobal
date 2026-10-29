import React, { useId } from 'react';
import { cx } from '../../lib/cx';
import { controlClass } from './controlClass';

// Campo de formulario: etiqueta + control + ayuda/error. El control recibe el id
// por render-prop o se clona para que la etiqueta quede asociada (accesibilidad).
export function Field({ label, hint, error, required = false, optional = false, className, children }) {
  const id = useId();
  const hintId = hint || error ? `${id}-desc` : undefined;
  const control = typeof children === 'function'
    ? children({ id, 'aria-describedby': hintId, 'aria-invalid': error ? true : undefined })
    : React.cloneElement(children, {
      id: children.props.id ?? id,
      'aria-describedby': hintId,
      'aria-invalid': error ? true : undefined,
    });
  const controlId = typeof children === 'function' ? id : (children.props.id ?? id);
  return (
    <div className={className}>
      {label && (
        <label htmlFor={controlId} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-fg">
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(obligatorio)</span>}
          {optional && <span className="text-xs font-normal text-fg-subtle">(opcional)</span>}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p id={hintId} className={cx('mt-1.5 text-xs', error ? 'text-danger font-medium' : 'text-fg-subtle')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={cx(controlClass, invalid && 'border-danger', className)} {...props} />;
});

export const Select = React.forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cx(controlClass, 'pr-8 cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
});
