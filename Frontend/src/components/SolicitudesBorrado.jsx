import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw, Inbox, ArrowDown, ArrowUp, MapPin, User, Clock } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { Card } from './ui/Card';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import Segmented from './ui/Segmented';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import { Field } from './ui/Field';
import { LoadingState } from './ui/Spinner';
import { controlClass } from './ui/controlClass';
import { useConfirm, useToast } from '../context/feedback';
import { avisarCambioSolicitudes } from '../hooks/useSolicitudesPendientes';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import { formatFecha } from '../lib/format';
import { cx } from '../lib/cx';

const ESTADOS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

const kg = (v) => (v === null || v === undefined || v === ''
  ? '—'
  : `${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg`);

function TablaOperaciones({ operaciones }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-fg-subtle">
          <tr>
            <th className="px-3 py-2 text-left font-medium">N° op.</th>
            <th className="px-3 py-2 text-left font-medium">Patente</th>
            <th className="px-3 py-2 text-left font-medium">Sentido</th>
            <th className="px-3 py-2 text-left font-medium">Producto</th>
            <th className="px-3 py-2 text-right font-medium">Bruto</th>
            <th className="px-3 py-2 text-right font-medium">Tara</th>
            <th className="px-3 py-2 text-right font-medium">Neto</th>
            <th className="px-3 py-2 text-left font-medium">Entrada</th>
            <th className="px-3 py-2 text-left font-medium">Salida</th>
          </tr>
        </thead>
        <tbody>
          {operaciones.map(o => {
            const ingreso = o.sentido === 'INGRESO';
            return (
              <tr key={o.operacion_id} className="border-t border-line">
                <td className="px-3 py-2 tabular text-fg-muted">#{o.operacion_id}</td>
                <td className="px-3 py-2 font-mono font-semibold tracking-wide text-fg">{o.vehiculo_patente}</td>
                <td className="px-3 py-2">
                  <Badge size="sm" tone={ingreso ? 'ingreso' : 'salida'} icon={ingreso ? ArrowDown : ArrowUp}>
                    {ingreso ? 'Ingreso' : 'Salida'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-fg-muted">{o.producto ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular whitespace-nowrap">{kg(o.bruto)}</td>
                <td className="px-3 py-2 text-right tabular whitespace-nowrap text-fg-muted">{kg(o.tara)}</td>
                <td className="px-3 py-2 text-right tabular whitespace-nowrap font-semibold">{kg(o.neto)}</td>
                <td className="px-3 py-2 tabular text-xs whitespace-nowrap text-fg-muted">{formatFecha(o.fecha_entrada)}</td>
                <td className="px-3 py-2 tabular text-xs whitespace-nowrap text-fg-muted">{formatFecha(o.fecha_salida)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TarjetaSolicitud({ s, onAprobar, onRechazar, ocupada }) {
  const n = s.operaciones.length;
  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-sm font-semibold text-fg">
            Pedido #{s.id} · {n} {n !== 1 ? 'operaciones' : 'operación'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
            <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{s.localidad_nombre}</span>
            <span className="inline-flex items-center gap-1"><User size={12} aria-hidden="true" />{s.solicitado_por_username}</span>
            <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden="true" />{formatFecha(s.created_at)}</span>
          </div>
        </div>
        {s.estado === 'pendiente' ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={X} onClick={() => onRechazar(s)} disabled={ocupada}>
              Rechazar
            </Button>
            <Button size="sm" variant="danger" icon={Check} onClick={() => onAprobar(s)} disabled={ocupada} loading={ocupada}>
              Aprobar y borrar
            </Button>
          </div>
        ) : (
          <Badge tone={s.estado === 'aprobada' ? 'danger' : 'neutral'}>
            {s.estado === 'aprobada' ? 'Borradas' : 'Rechazada'}
          </Badge>
        )}
      </div>

      <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Motivo</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-fg">{s.motivo}</p>
      </div>

      <TablaOperaciones operaciones={s.operaciones} />

      {s.estado !== 'pendiente' && (
        <p className="text-xs text-fg-subtle">
          {s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'} por {s.resuelto_por_username ?? '—'} el {formatFecha(s.resuelto_at)}
          {s.comentario_resolucion && <> · <span className="text-fg-muted">{s.comentario_resolucion}</span></>}
        </p>
      )}
    </Card>
  );
}

// Bandeja del superadmin con los pedidos de borrado de los balanceros
export default function SolicitudesBorrado() {
  const confirm = useConfirm();
  const toast = useToast();
  const [estado, setEstado] = useState('pendiente');
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ocupada, setOcupada] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [comentario, setComentario] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitudes-borrado?estado=${estado}`, { headers: getAuthHeaders(null) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudieron cargar los pedidos');
      setSolicitudes(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [estado]);

  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (s, accion, body = {}) => {
    setOcupada(s.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitudes-borrado/${s.id}/${accion}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo resolver el pedido');
      toast.success(data.message);
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setOcupada(null);
      avisarCambioSolicitudes();
      cargar();
    }
  };

  const aprobar = async (s) => {
    const n = s.operaciones.length;
    const ok = await confirm({
      title: 'Borrar operaciones',
      message: `${n !== 1 ? `Se borran ${n} operaciones` : 'Se borra 1 operación'} de ${s.localidad_nombre} con sus pesadas. Esta acción no se puede deshacer.`,
      confirmLabel: 'Aprobar y borrar',
      tone: 'danger',
    });
    if (ok) resolver(s, 'aprobar');
  };

  const confirmarRechazo = async (e) => {
    e.preventDefault();
    const s = rechazando;
    const ok = await resolver(s, 'rechazar', { comentario: comentario.trim() || undefined });
    if (ok) { setRechazando(null); setComentario(''); }
  };

  return (
    <div>
      <PageHeader
        title="Solicitudes de borrado"
        description="Pedidos de los balanceros para borrar operaciones. Mientras están pendientes, el balancero no las ve."
        actions={(
          <Button variant="secondary" icon={RefreshCw} onClick={cargar} disabled={loading}>Actualizar</Button>
        )}
      />

      <Segmented options={ESTADOS} value={estado} onChange={setEstado} size="md" className="mb-4" />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {loading ? (
        <LoadingState texto="Cargando pedidos..." />
      ) : solicitudes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={estado === 'pendiente' ? 'No hay pedidos pendientes' : 'Sin pedidos en esta lista'}
            description={estado === 'pendiente' ? 'Cuando un balancero pida borrar operaciones, aparecen acá.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <TarjetaSolicitud
              key={s.id}
              s={s}
              ocupada={ocupada === s.id}
              onAprobar={aprobar}
              onRechazar={(sol) => { setComentario(''); setRechazando(sol); }}
            />
          ))}
        </div>
      )}

      {rechazando && (
        <Modal
          title="Rechazar pedido"
          subtitle={`Pedido #${rechazando.id} · ${rechazando.localidad_nombre}`}
          icon={X}
          onClose={ocupada ? undefined : () => setRechazando(null)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setRechazando(null)} disabled={Boolean(ocupada)}>Cancelar</Button>
              <Button variant="primary" type="submit" form="form-rechazar-borrado" loading={Boolean(ocupada)}>Rechazar pedido</Button>
            </>
          )}
        >
          <form id="form-rechazar-borrado" onSubmit={confirmarRechazo} className="space-y-4">
            <p className="text-sm text-fg-muted">
              Las {rechazando.operaciones.length} operaciones vuelven a aparecer en el historial del balancero.
            </p>
            <Field label="Comentario" optional>
              <textarea
                data-autofocus
                rows={3}
                maxLength={1000}
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                className={cx(controlClass, 'h-auto py-2 resize-y')}
              />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
