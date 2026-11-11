import React, { useState } from 'react';
import { Send, Clock } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Alert from './ui/Alert';
import { Field } from './ui/Field';
import { controlClass } from './ui/controlClass';
import { cx } from '../lib/cx';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

const MAX_MOTIVO = 1000;

// El balancero pide borrar operaciones: indica el motivo y se mandan al superadmin.
// Desde ese momento dejan de mostrársele; si el pedido se rechaza, vuelven a aparecer.
export default function SolicitarBorradoModal({ operaciones, onClose, onEnviada }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(false);

  const enProceso = operaciones.filter(o => o.abierta);
  const motivoVacio = !motivo.trim();

  const enviar = async (e) => {
    e.preventDefault();
    setIntento(true);
    if (motivoVacio || enProceso.length) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pesadas/operaciones/solicitar-borrado`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids: operaciones.map(o => o.id), motivo: motivo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo enviar el pedido');
      onEnviada?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const n = operaciones.length;

  return (
    <Modal
      onClose={enviando ? undefined : onClose}
      closeOnOverlay={!enviando}
      title="Solicitar borrado"
      subtitle={`${n} ${n !== 1 ? 'operaciones' : 'operación'} seleccionada${n !== 1 ? 's' : ''}`}
      icon={Send}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button
            variant="danger"
            icon={Send}
            type="submit"
            form="form-solicitar-borrado"
            loading={enviando}
            disabled={enviando || enProceso.length > 0}
          >
            Enviar pedido
          </Button>
        </>
      )}
    >
      <form id="form-solicitar-borrado" onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-fg-muted">
          El pedido le llega al administrador. Mientras lo revisa, estas operaciones dejan de
          aparecer en tu historial. Si lo rechaza, vuelven a aparecer.
        </p>

        <ul className="flex flex-wrap gap-1.5" aria-label="Operaciones seleccionadas">
          {operaciones.map(o => (
            <li
              key={o.id}
              className={cx(
                'rounded-md border px-2 py-1 text-xs',
                o.abierta ? 'border-warning bg-warning-soft text-warning' : 'border-line bg-surface-2 text-fg-muted'
              )}
            >
              <span className="tabular">#{o.operacion_id ?? o.id}</span>{' '}
              <span className="font-mono font-semibold text-fg">{o.vehiculo_patente}</span>
              {o.abierta && <Clock size={11} className="inline ml-1" aria-label="En proceso" />}
            </li>
          ))}
        </ul>

        {enProceso.length > 0 && (
          <Alert tone="warning">
            Hay operaciones en proceso ({enProceso.map(o => o.vehiculo_patente).join(', ')}). Solo se puede
            pedir el borrado de operaciones completadas: quitalas de la selección o completá la pesada.
          </Alert>
        )}

        <Field
          label="Motivo"
          required
          error={intento && motivoVacio ? 'Indicá por qué hay que borrarlas' : undefined}
          hint={`Ej.: pesada duplicada, patente equivocada. ${motivo.length}/${MAX_MOTIVO}`}
        >
          <textarea
            data-autofocus
            rows={4}
            maxLength={MAX_MOTIVO}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className={cx(controlClass, 'h-auto py-2 resize-y', intento && motivoVacio && 'border-danger')}
          />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
