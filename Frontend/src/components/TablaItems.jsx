import React, { useState, useRef } from 'react';
import { Pencil, Trash2, Eye, FileText, Upload, Package, Power, PowerOff, FileBarChart, ArrowDown, ArrowUp, Clock, CheckCircle2 } from 'lucide-react';
import Guard from './Guard';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { formatFecha } from '../lib/format';
import { cx } from '../lib/cx';

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const COLUMNAS_PESO = ['bruto', 'tara', 'neto'];
const kg = (v) => `${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg`;
const estaActivo = (item) => item.activo ?? (item.estado === 'activo');

function RenderCelda({ item, keyName }) {
  const value = item[keyName];

  if (value === null || value === undefined || value === '') {
    if (COLUMNAS_PESO.includes(keyName)) return <span className="text-xs italic text-fg-subtle">Pendiente</span>;
    return <span className="text-fg-subtle">—</span>;
  }

  if (keyName === 'codigo') return <span className="font-mono text-xs font-semibold text-fg">{value}</span>;

  if (keyName === 'precio') return (
    <span className="tabular font-semibold">
      ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );

  if (keyName === 'estado' || keyName === 'activo') {
    const activo = value === 'activo' || value === true || value === 'true';
    return <Badge tone={activo ? 'success' : 'neutral'} dot>{activo ? 'Activo' : 'Inactivo'}</Badge>;
  }

  if (keyName === 'sentido') {
    const ingreso = value === 'INGRESO';
    return <Badge tone={ingreso ? 'ingreso' : 'salida'} icon={ingreso ? ArrowDown : ArrowUp}>{ingreso ? 'Ingreso' : 'Salida'}</Badge>;
  }

  if (keyName === 'abierta') return value
    ? <Badge tone="warning" icon={Clock}>En proceso</Badge>
    : <Badge tone="success" icon={CheckCircle2}>Completada</Badge>;

  if (keyName === 'vehiculo_patente' || keyName === 'patente' || keyName === 'patente_acoplado') {
    return <span className="font-mono font-semibold text-fg tracking-wide">{value}</span>;
  }

  if (keyName === 'operacion_id') return <span className="tabular text-fg-muted">#{value}</span>;

  if (keyName === 'bruto') return <span className="tabular font-medium text-fg">{kg(value)}</span>;
  if (keyName === 'tara') return <span className="tabular text-fg-muted">{kg(value)}</span>;
  if (keyName === 'neto') {
    const numero = Number(value);
    return <span className={cx('tabular font-semibold', numero < 0 ? 'text-danger' : 'text-fg')}>{kg(numero)}</span>;
  }

  if (keyName.includes('fecha') || ['created_at', 'updated_at'].includes(keyName))
    return <span className="tabular text-xs whitespace-nowrap text-fg-muted">{formatFecha(value)}</span>;

  if (keyName === 'tipo_vehiculo') return <span>{String(value).replace(/_/g, ' ')}</span>;

  return <span className="break-words">{String(value)}</span>;
}

/* ─── Acciones de una pesada (fila y tarjeta) ───────────────────────────── */
function AccionesPesada({ item, onSubirPDF, onVerDetalles, onContenedor }) {
  const tam = 'sm';
  return (
    <>
      <Button size={tam} variant="ghost" icon={Eye} onClick={() => onVerDetalles?.(item)}>
        Detalles
      </Button>
      {item.ruta ? (
        <Button
          as="a"
          size={tam}
          variant="soft"
          icon={FileText}
          href={item.ruta.startsWith('documentos/') ? `/${item.ruta}` : `/documentos/${item.ruta}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Abrir carta de porte (PDF)"
        >
          Carta de porte
        </Button>
      ) : (
        <Guard permissions="pesaje:update">
          <Button as="label" size={tam} variant="secondary" icon={Upload} onClick={e => e.stopPropagation()} title="Adjuntar carta de porte (PDF)">
            Subir PDF
            <input type="file" className="sr-only" accept="application/pdf" onChange={e => onSubirPDF?.(e, item.id)} />
          </Button>
        </Guard>
      )}
      {item.es_contenedor && (
        <Guard permissions="pesaje:update">
          <Button size={tam} variant="secondary" icon={Package} onClick={e => { e.stopPropagation(); onContenedor?.(item); }} title="Completar datos de contenedor">
            Contenedor
          </Button>
        </Guard>
      )}
    </>
  );
}

/* ─── Acciones de un registro de catálogo ───────────────────────────────── */
function AccionesCatalogo({ item, resourcePrefix, onToggleEstado, onEditar, onEliminar, conTexto }) {
  const activo = estaActivo(item);
  return (
    <>
      <Guard permissions={`${resourcePrefix}:update`}>
        <Button
          size={conTexto ? 'sm' : 'icon-sm'}
          variant="ghost"
          icon={activo ? PowerOff : Power}
          onClick={() => onToggleEstado(item.id)}
          title={activo ? 'Desactivar' : 'Activar'}
          aria-label={activo ? 'Desactivar' : 'Activar'}
        >
          {conTexto && (activo ? 'Desactivar' : 'Activar')}
        </Button>
      </Guard>
      <Guard permissions={`${resourcePrefix}:update`}>
        <Button size={conTexto ? 'sm' : 'icon-sm'} variant="ghost" icon={Pencil} onClick={() => onEditar(item)} title="Editar" aria-label="Editar">
          {conTexto && 'Editar'}
        </Button>
      </Guard>
      <Guard permissions={`${resourcePrefix}:delete`}>
        <Button
          size={conTexto ? 'sm' : 'icon-sm'}
          variant="ghost"
          icon={Trash2}
          onClick={() => onEliminar(item.id)}
          title="Eliminar"
          aria-label="Eliminar"
          className="hover:!text-danger hover:!bg-danger-soft"
        >
          {conTexto && 'Eliminar'}
        </Button>
      </Guard>
    </>
  );
}

/* ─── Fila de tabla (escritorio) ────────────────────────────────────────── */
const FilaTabla = React.memo(({
  item, tipo, selected, columnasKeys,
  onToggleSeleccion, onToggleEstado, onEditar, onEliminar, onSubirPDF, onVerDetalles, onContenedor,
  soloLectura, mostrarColumnaAcciones,
}) => {
  const resourcePrefix = tipo === 'pesadas' ? 'pesaje' : tipo;
  return (
    <tr className={cx('group border-b border-line last:border-b-0 transition-colors', selected ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
      {tipo === 'pesadas' && (
        <td className="w-10 pl-4 pr-1 py-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onToggleSeleccion(e, item.id)}
            aria-label={`Seleccionar operación ${item.operacion_id ?? item.id}`}
            className="h-4 w-4 accent-[var(--brand-solid)] cursor-pointer"
          />
        </td>
      )}

      {columnasKeys.map(key => (
        <td key={key} className={cx('px-4 py-2.5 text-sm text-fg', COLUMNAS_PESO.includes(key) && 'text-right whitespace-nowrap')}>
          <RenderCelda item={item} keyName={key} />
        </td>
      ))}

      {mostrarColumnaAcciones && (
        <td className={cx(
          'sticky right-0 px-4 py-2 text-right shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.15)]',
          selected ? 'bg-brand-soft' : 'bg-surface group-hover:bg-surface-2'
        )}>
          <div className="flex justify-end gap-1">
            {!soloLectura && (
              <AccionesCatalogo item={item} resourcePrefix={resourcePrefix} onToggleEstado={onToggleEstado} onEditar={onEditar} onEliminar={onEliminar} />
            )}
            {tipo === 'pesadas' && (
              <AccionesPesada item={item} onSubirPDF={onSubirPDF} onVerDetalles={onVerDetalles} onContenedor={onContenedor} />
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

/* ─── Tarjeta (móvil) ───────────────────────────────────────────────────── */
const CardItem = React.memo(({
  item, tipo, selected, columnasKeys, columnasLabels,
  onToggleSeleccion, onToggleEstado, onEditar, onEliminar, onSubirPDF, onVerDetalles, onContenedor,
  soloLectura, mostrarColumnaAcciones,
}) => {
  const resourcePrefix = tipo === 'pesadas' ? 'pesaje' : tipo;
  const resto = columnasKeys.slice(2);
  return (
    <div className={cx('rounded-lg border p-4 transition-colors', selected ? 'border-brand-solid bg-brand-soft/60' : 'border-line bg-surface')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {tipo === 'pesadas' && (
            <input
              type="checkbox"
              checked={selected}
              onChange={e => onToggleSeleccion(e, item.id)}
              aria-label={`Seleccionar operación ${item.operacion_id ?? item.id}`}
              className="mt-1 h-5 w-5 accent-[var(--brand-solid)] shrink-0"
            />
          )}
          {columnasKeys[0] && (
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{columnasLabels[0]}</p>
              <div className="text-sm font-semibold text-fg"><RenderCelda item={item} keyName={columnasKeys[0]} /></div>
            </div>
          )}
        </div>
        {columnasKeys[1] && (
          <div className="text-right shrink-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{columnasLabels[1]}</p>
            <div className="text-sm text-fg"><RenderCelda item={item} keyName={columnasKeys[1]} /></div>
          </div>
        )}
      </div>

      {resto.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-3 text-sm">
          {resto.map((key, i) => (
            <div key={key} className={i === resto.length - 1 && resto.length % 2 !== 0 ? 'col-span-2' : ''}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{columnasLabels[i + 2]}</dt>
              <dd className="text-fg"><RenderCelda item={item} keyName={key} /></dd>
            </div>
          ))}
        </dl>
      )}

      {mostrarColumnaAcciones && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {!soloLectura && (
            <AccionesCatalogo item={item} resourcePrefix={resourcePrefix} onToggleEstado={onToggleEstado} onEditar={onEditar} onEliminar={onEliminar} conTexto />
          )}
          {tipo === 'pesadas' && (
            <AccionesPesada item={item} onSubirPDF={onSubirPDF} onVerDetalles={onVerDetalles} onContenedor={onContenedor} />
          )}
        </div>
      )}
    </div>
  );
});

/* ─── Componente principal ──────────────────────────────────────────────── */
const TablaItems = React.memo(({
  items, tipo, columnasKeys, columnasLabels,
  onEditar, onEliminar, onToggleEstado, onSubirPDF, onVerDetalles, onContenedor,
  onGenerarReporte, onEliminarMultiples, soloLectura = false,
  hasMore, loadMore, loadingMore
}) => {
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [generando, setGenerando] = useState(false);
  const reporteEnProceso = useRef(false);

  const handleToggleSeleccion = React.useCallback((e, id) => {
    e.stopPropagation();
    setSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleTodas = () => {
    setSeleccionadas(prev =>
      prev.size === items.length && items.length > 0
        ? new Set()
        : new Set(items.map(i => i.id))
    );
  };

  const handleGenerarReporte = async () => {
    if (reporteEnProceso.current) return;
    reporteEnProceso.current = true;
    setGenerando(true);
    try {
      const sel = items.filter(i => seleccionadas.has(i.id));
      if (!sel.length) return;
      await onGenerarReporte?.(sel);
      setSeleccionadas(new Set());
    } catch (err) {
      console.error('Error al generar reporte:', err);
    } finally {
      reporteEnProceso.current = false;
      setGenerando(false);
    }
  };

  // La confirmación la pide GestionApp (una sola vez)
  const handleEliminarSeleccionadas = async () => {
    if (!seleccionadas.size) return;
    try {
      const ids = items.filter(i => seleccionadas.has(i.id)).map(i => i.id);
      const eliminadas = await onEliminarMultiples?.(ids);
      if (eliminadas !== false) setSeleccionadas(new Set());
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const todasSeleccionadas = items.length > 0 && seleccionadas.size === items.length;
  const algunaSeleccionada = seleccionadas.size > 0;
  const mostrarColumnaAcciones = !soloLectura || tipo === 'pesadas';

  const sharedRowProps = {
    tipo, columnasKeys, columnasLabels,
    onToggleSeleccion: handleToggleSeleccion,
    onToggleEstado, onEditar, onEliminar, onSubirPDF, onVerDetalles, onContenedor,
    soloLectura, mostrarColumnaAcciones,
  };

  // --- Carga progresiva al llegar al final ---
  const observerTarget = useRef(null);

  React.useEffect(() => {
    if (!hasMore || !loadMore || (tipo !== 'pesadas' && tipo !== 'vehiculos')) return;
    const target = observerTarget.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore, tipo]);

  return (
    <div>
      {/* Barra de selección / reporte — solo pesadas */}
      {tipo === 'pesadas' && (
        <div className={cx(
          'flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-line',
          algunaSeleccionada ? 'bg-brand-soft/60' : 'bg-surface-2'
        )}>
          <label className="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={todasSeleccionadas}
              ref={el => { if (el) el.indeterminate = algunaSeleccionada && !todasSeleccionadas; }}
              onChange={toggleTodas}
              className="h-4 w-4 accent-[var(--brand-solid)]"
            />
            {algunaSeleccionada
              ? <span><strong className="text-fg">{seleccionadas.size}</strong> seleccionada{seleccionadas.size !== 1 ? 's' : ''}</span>
              : 'Seleccionar todas las cargadas'}
          </label>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={algunaSeleccionada ? 'primary' : 'secondary'}
              icon={FileBarChart}
              onClick={handleGenerarReporte}
              disabled={!algunaSeleccionada || generando}
              loading={generando}
              title={algunaSeleccionada ? 'Generar reporte con las operaciones seleccionadas' : 'Seleccioná operaciones para generar un reporte'}
            >
              {generando ? 'Generando…' : 'Generar reporte'}
            </Button>
            <Guard permissions="pesaje:delete">
              <Button
                size="sm"
                variant="danger-soft"
                icon={Trash2}
                onClick={handleEliminarSeleccionadas}
                disabled={!algunaSeleccionada}
              >
                Eliminar
              </Button>
            </Guard>
          </div>
        </div>
      )}

      {/* Móvil: tarjetas */}
      <div className="md:hidden space-y-3 p-3">
        {items.map(item => (
          <CardItem key={item.id} item={item} selected={seleccionadas.has(item.id)} {...sharedRowProps} />
        ))}
      </div>

      {/* Escritorio: tabla */}
      <div className="hidden md:block relative overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-[1] bg-surface-2">
            <tr className="border-b border-line">
              {tipo === 'pesadas' && <th className="w-10 pl-4 pr-1"><span className="sr-only">Selección</span></th>}
              {columnasLabels.map((label, i) => (
                <th
                  key={label}
                  scope="col"
                  className={cx(
                    'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle whitespace-nowrap',
                    COLUMNAS_PESO.includes(columnasKeys[i]) ? 'text-right' : 'text-left'
                  )}
                >
                  {label}
                </th>
              ))}
              {mostrarColumnaAcciones && (
                <th scope="col" className="sticky right-0 bg-surface-2 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <FilaTabla key={item.id} item={item} selected={seleccionadas.has(item.id)} {...sharedRowProps} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Centinela de carga progresiva */}
      {(tipo === 'pesadas' || tipo === 'vehiculos') && (
        <div ref={observerTarget} className="py-6 flex items-center justify-center border-t border-line">
          {loadingMore ? (
            <span role="status" className="flex items-center gap-2 text-sm text-fg-muted">
              <Spinner className="text-brand" />
              Cargando más {tipo === 'pesadas' ? 'pesadas' : 'vehículos'}...
            </span>
          ) : !hasMore && items.length > 0 ? (
            <span className="text-xs text-fg-subtle">No hay más registros</span>
          ) : null}
        </div>
      )}
    </div>
  );
});

export default TablaItems;
