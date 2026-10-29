import React, { useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { FeedbackContext } from '../../context/feedback';
import { cx } from '../../lib/cx';
import Modal from './Modal';
import Button from './Button';

const TONOS = {
  success: { Icon: CheckCircle2, cls: 'text-success' },
  error: { Icon: AlertCircle, cls: 'text-danger' },
  info: { Icon: Info, cls: 'text-info' },
};

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const siguienteId = useRef(0);

  const cerrarToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const mostrar = useCallback((tipo, mensaje, duracion = tipo === 'error' ? 7000 : 3500) => {
    const id = ++siguienteId.current;
    setToasts(prev => [...prev.slice(-3), { id, tipo, mensaje }]);
    setTimeout(() => cerrarToast(id), duracion);
  }, [cerrarToast]);

  const toast = useMemo(() => ({
    success: (m, d) => mostrar('success', m, d),
    error: (m, d) => mostrar('error', m, d),
    info: (m, d) => mostrar('info', m, d),
  }), [mostrar]);

  const confirm = useCallback((opciones) => new Promise((resolve) => {
    setDialogo({ ...opciones, resolve });
  }), []);

  const responder = (valor) => {
    dialogo?.resolve(valor);
    setDialogo(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div aria-live="polite" className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96 pointer-events-none">
        {toasts.map(t => {
          const { Icon, cls } = TONOS[t.tipo];
          return (
            <div
              key={t.id}
              role={t.tipo === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg shadow-pop animate-pop-in"
            >
              <Icon size={18} aria-hidden="true" className={cx('mt-0.5 shrink-0', cls)} />
              <p className="flex-1">{t.mensaje}</p>
              <button type="button" onClick={() => cerrarToast(t.id)} aria-label="Cerrar aviso" className="text-fg-subtle hover:text-fg">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {dialogo && (
        <Modal
          size="sm"
          onClose={() => responder(false)}
          title={dialogo.title ?? '¿Confirmar?'}
          icon={dialogo.tone === 'danger' ? AlertTriangle : Info}
          footer={(
            <>
              <Button onClick={() => responder(false)}>{dialogo.cancelLabel ?? 'Cancelar'}</Button>
              <Button
                variant={dialogo.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => responder(true)}
                data-autofocus
              >
                {dialogo.confirmLabel ?? 'Confirmar'}
              </Button>
            </>
          )}
        >
          <p className="text-sm text-fg-muted">{dialogo.message}</p>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}
