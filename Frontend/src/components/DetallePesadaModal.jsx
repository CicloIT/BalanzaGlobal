import React from 'react';
import { FileText, Camera, Scale, Package, ArrowDown, ArrowUp, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { cx } from '../lib/cx';

const formatFecha = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('es-AR');
};

const kg = (v) => (v != null ? `${Number(v).toLocaleString('es-AR')} kg` : '—');

function Seccion({ icon: Icon, titulo, children }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        <Icon size={14} aria-hidden="true" /> {titulo}
      </h3>
      {children}
    </section>
  );
}

function Datos({ filas }) {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line">
      {filas.filter(Boolean).map(([label, value]) => (
        <div key={label} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-sm">
          <dt className="text-fg-subtle">{label}</dt>
          <dd className="min-w-0 break-words text-fg">{value || <span className="text-fg-subtle italic">No especificado</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function Peso({ label, value, destacado = false }) {
  return (
    <div className={cx('rounded-lg border px-3 py-2.5', destacado ? 'border-brand-solid/40 bg-brand-soft' : 'border-line bg-surface-2')}>
      <p className="text-xs text-fg-subtle">{label}</p>
      {value != null
        ? <p className={cx('font-mono font-bold tabular text-fg', destacado ? 'text-2xl' : 'text-lg')}>{kg(value)}</p>
        : <p className={cx('italic text-fg-subtle', destacado ? 'text-lg' : 'text-base')}>Pendiente</p>}
    </div>
  );
}

export default function DetallePesadaModal({ abierto, item, onClose }) {
  if (!abierto || !item) return null;

  // Procesar fotos: el backend devuelve todas_fotos como un array de arrays por el jsonb_agg
  const fotosRaw = item.todas_fotos || (item.fotos ? [item.fotos] : []);
  const fotos = Array.isArray(fotosRaw) ? fotosRaw.flat().filter(Boolean) : [];
  const esSalida = item.sentido === 'SALIDA';
  const rutaPdf = item.ruta ? (item.ruta.startsWith('documentos/') ? `/${item.ruta}` : `/documentos/${item.ruta}`) : null;

  return (
    <Modal
      size="xl"
      onClose={onClose}
      icon={Scale}
      title={`Operación #${item.operacion_id || item.id}`}
      subtitle={item.vehiculo_patente}
      footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-semibold tracking-wide text-fg">{item.vehiculo_patente}</span>
        {item.sentido && (
          <Badge tone={esSalida ? 'salida' : 'ingreso'} icon={esSalida ? ArrowUp : ArrowDown}>{esSalida ? 'Salida' : 'Ingreso'}</Badge>
        )}
        {item.abierta
          ? <Badge tone="warning" icon={Clock}>En proceso</Badge>
          : <Badge tone="success" icon={CheckCircle2}>Completada</Badge>}
        {item.es_contenedor && <Badge tone="info" icon={Package}>Contenedor</Badge>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Seccion icon={Scale} titulo="Pesos y tiempos">
            <div className="grid grid-cols-2 gap-3">
              <Peso label="Bruto" value={item.bruto} />
              <Peso label="Tara" value={item.tara} />
              <div className="col-span-2"><Peso label="Neto" value={item.neto} destacado /></div>
            </div>
            <div className="mt-3">
              <Datos filas={[
                ['Entrada a planta', formatFecha(item.fecha_entrada)],
                ['Salida de planta', formatFecha(item.fecha_salida)],
              ]} />
            </div>
          </Seccion>

          <Seccion icon={FileText} titulo="Datos de la carga">
            <Datos filas={[
              ['Transporte', item.transporte],
              ['Chofer', item.chofer],
              ['Producto', item.producto],
              ['Productor', item.productor],
              ['Nro. de remito', item.nro_remito],
              ['Balancero', item.balancero],
            ]} />
          </Seccion>

          {item.es_contenedor && (
            <Seccion icon={Package} titulo="Datos de contenedor">
              <Datos filas={[
                ['Nro. contenedor', item.nro_contenedor],
                item.peso_vgm != null && ['Peso VGM', kg(item.peso_vgm)],
                item.tara_contenedor != null && ['Tara contenedor', kg(item.tara_contenedor)],
                item.cantidad_bultos != null && ['Cantidad de bultos', item.cantidad_bultos],
                item.nro_proforma && ['Nro. proforma', item.nro_proforma],
                item.nro_permiso_embarque && ['Permiso de embarque', item.nro_permiso_embarque],
              ]} />
            </Seccion>
          )}
        </div>

        <div className="space-y-6">
          <Seccion icon={FileText} titulo="Carta de porte">
            {rutaPdf ? (
              <a
                href={rutaPdf}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 hover:bg-surface-2"
              >
                <FileText size={20} className="text-brand shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-fg">Carta de porte / remito</span>
                  <span className="block text-xs text-fg-subtle">PDF adjunto · se abre en otra pestaña</span>
                </span>
                <ExternalLink size={16} className="text-fg-subtle" aria-hidden="true" />
              </a>
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-fg-subtle">
                No hay PDF adjunto. Se puede subir desde el historial.
              </p>
            )}
          </Seccion>

          <Seccion icon={Camera} titulo={`Capturas de cámaras${fotos.length ? ` (${fotos.length})` : ''}`}>
            {fotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {fotos.map((foto, idx) => {
                  const src = typeof foto === 'string' ? foto : foto.ruta;
                  const canal = typeof foto === 'object' ? foto.canal : null;
                  return (
                    <a
                      key={idx}
                      href={`/capturas/${src}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block aspect-video overflow-hidden rounded-lg border border-line bg-surface-2"
                      title="Ver en tamaño completo"
                    >
                      <img src={`/capturas/${src}`} alt={canal ? `Cámara ${canal}` : `Captura ${idx + 1}`} loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {canal ? `Cámara ${canal}` : `Captura ${idx + 1}`}
                      </span>
                      <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <ExternalLink size={20} className="text-white" aria-hidden="true" />
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-subtle">
                <Camera size={22} className="mx-auto mb-2" aria-hidden="true" />
                Esta operación no tiene fotos
              </p>
            )}
          </Seccion>
        </div>
      </div>
    </Modal>
  );
}
