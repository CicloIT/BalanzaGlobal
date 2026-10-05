import React, { useState, useRef } from 'react';
import { Edit2, Trash2, Eye, EyeOff, FileText, CheckSquare, Square, Upload, Package } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import Guard from './Guard';

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatFecha(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function RenderCelda({ item, keyName, isDark }) {
  const value = item[keyName];

  if (value === null || value === undefined) {
    if (['bruto', 'tara', 'neto'].includes(keyName))
      return <span className="text-slate-400 italic text-xs">Pendiente</span>;
    return <span className="text-slate-400">-</span>;
  }

  if (keyName === 'codigo') return (
    <span className={`px-2 py-0.5 rounded-lg font-mono font-bold text-xs ${isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
      {value}
    </span>
  );

  if (keyName === 'precio') return (
    <span className={`font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
      ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );

  if (keyName === 'estado') {
    const isActivo = value === 'activo' || value === true || value === 'true';
    return (
      <span className={`px-2 py-0.5 rounded-lg font-semibold text-xs ${isActivo
        ? isDark ? 'bg-green-500/30 text-green-300' : 'bg-green-100 text-green-700'
        : isDark ? 'bg-red-500/30 text-red-300' : 'bg-red-100 text-red-700'
        }`}>
        {isActivo ? 'Activo' : 'Inactivo'}
      </span>
    );
  }

  if (keyName === 'sentido') {
    const isIngreso = value === 'INGRESO';
    return (
      <span className={`px-2 py-0.5 rounded-lg font-semibold text-xs ${isIngreso
        ? isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700'
        : isDark ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-100 text-orange-700'
        }`}>
        {isIngreso ? '↓ INGRESO' : '↑ SALIDA'}
      </span>
    );
  }

  if (keyName === 'abierta') return (
    <span className={`px-2 py-0.5 rounded-lg font-semibold text-xs ${value
      ? isDark ? 'bg-yellow-500/30 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
      : isDark ? 'bg-green-500/30 text-green-300' : 'bg-green-100 text-green-700'
      }`}>
      {value ? 'En Proceso' : 'Completada'}
    </span>
  );

  if (keyName === 'bruto') return (
    <span className={`font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`}>
      {Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg
    </span>
  );

  if (keyName === 'tara') return (
    <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
      {Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg
    </span>
  );

  if (keyName === 'neto') {
    const numero = Number(value);
    const esNegativo = numero < 0;

    return (
      <span
        className={`font-bold text-base ${esNegativo
          ? isDark
            ? 'text-red-400'
            : 'text-red-600'
          : isDark
            ? 'text-cyan-300'
            : 'text-cyan-700'
          }`}
      >
        {numero.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg
      </span>
    );
  }

  if (keyName.includes('fecha') || ['created_at', 'updated_at'].includes(keyName))
    return <span className="font-mono text-xs whitespace-nowrap">{formatFecha(value)}</span>;

  return <span className="break-words">{String(value)}</span>;
}

/* ─── Action buttons (reused in table row & card) ───────────────────────── */
function AccionesPesada({ item, isDark, onSubirPDF, onVerDetalles, onContenedor }) {
  return (
    <>
      <button
        onClick={() => onVerDetalles?.(item)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:scale-105 ${isDark
          ? 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
          }`}
        title="Ver detalles completos"
      >
        <Eye size={14} /> Detalles
      </button>
      {item.ruta ? (
        <a
          href={item.ruta.startsWith('documentos/') ? `/${item.ruta}` : `/documentos/${item.ruta}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:scale-105 ${isDark
            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/40'
            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
        >
          <FileText size={14} /> Carta Porte
        </a>
      ) : (
        <Guard permissions="pesaje:update">
          <label
            onClick={e => e.stopPropagation()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:scale-105 ${isDark
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/40'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
          >
            <Upload size={14} /> Subir PDF
            <input type="file" className="hidden" accept="application/pdf"
              onChange={e => onSubirPDF?.(e, item.id)} />
          </label>
        </Guard>
      )}
      {item.es_contenedor && (
        <Guard permissions="pesaje:update">
          <button
            onClick={e => { e.stopPropagation(); onContenedor?.(item); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:scale-105 ${isDark
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/40'
              : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100'
              }`}
            title="Completar datos de contenedor"
          >
            <Package size={14} /> Contenedor
          </button>
        </Guard>
      )}
    </>
  );
}

/* ─── Desktop table row ─────────────────────────────────────────────────── */
const FilaTabla = React.memo(({
  item, idx, isDark, tipo, selected, columnasKeys, columnasLabels,
  onToggleSeleccion, onToggleEstado, onEditar, onEliminar, onSubirPDF, onVerDetalles, onContenedor,
  soloLectura, mostrarColumnaAcciones,
}) => {
  const resourcePrefix = tipo === 'pesadas' ? 'pesaje' : tipo;
  return (
    <tr className={`transition-all duration-150 ${selected
      ? isDark ? 'bg-indigo-500/10 border-b border-indigo-500/20' : 'bg-indigo-50 border-b border-indigo-100'
      : isDark ? 'border-b border-white/5 hover:bg-white/10' : 'border-b border-slate-100 hover:bg-slate-50'
      }`} style={{ animation: idx < 80 ? `fadeInRow 0.25s ease-out ${idx * 0.04}s both` : 'none' }}>

      {tipo === 'pesadas' && (
        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
          <button onClick={e => onToggleSeleccion(e, item.id)}>
            {selected
              ? <CheckSquare size={16} className="text-indigo-500" />
              : <Square size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />}
          </button>
        </td>
      )}

      {columnasKeys.map(key => (
        <td key={key} className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          <RenderCelda item={item} keyName={key} isDark={isDark} />
        </td>
      ))}

      {mostrarColumnaAcciones && (
        <td className="px-4 py-3">
          <div className="flex gap-1.5 flex-wrap">
            {!soloLectura && (
              <>
                <Guard permissions={`${resourcePrefix}:update`}>
                  <button onClick={() => onToggleEstado(item.id)}
                    className={`p-1.5 rounded-lg transition-all hover:scale-110 ${item.estado === 'activo'
                      ? isDark ? 'bg-green-500/30 text-green-400 hover:bg-green-500/50' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      : isDark ? 'bg-red-500/30 text-red-400 hover:bg-red-500/50' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`} title={item.estado === 'activo' ? 'Desactivar' : 'Activar'}>
                    {item.estado === 'activo' ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </Guard>
                <Guard permissions={`${resourcePrefix}:update`}>
                  <button onClick={() => onEditar(item)}
                    className={`p-1.5 rounded-lg transition-all hover:scale-110 ${isDark ? 'bg-blue-500/30 text-blue-400 hover:bg-blue-500/50' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    title="Editar">
                    <Edit2 size={15} />
                  </button>
                </Guard>
                <Guard permissions={`${resourcePrefix}:delete`}>
                  <button onClick={() => onEliminar(item.id)}
                    className={`p-1.5 rounded-lg transition-all hover:scale-110 ${isDark ? 'bg-red-500/30 text-red-400 hover:bg-red-500/50' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </Guard>
              </>
            )}
            {tipo === 'pesadas' && (
              <AccionesPesada item={item} isDark={isDark} onSubirPDF={onSubirPDF} onVerDetalles={onVerDetalles} onContenedor={onContenedor} />
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

/* ─── Mobile card ───────────────────────────────────────────────────────── */
const CardItem = React.memo(({
  item, idx, isDark, tipo, selected, columnasKeys, columnasLabels,
  onToggleSeleccion, onToggleEstado, onEditar, onEliminar, onSubirPDF, onVerDetalles, onContenedor,
  soloLectura, mostrarColumnaAcciones,
}) => {
  const resourcePrefix = tipo === 'pesadas' ? 'pesaje' : tipo;
  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${selected
        ? isDark ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'
        : isDark ? 'bg-white/5 border-white/8 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
        }`}
      style={{ animation: idx < 40 ? `fadeInRow 0.25s ease-out ${idx * 0.05}s both` : 'none' }}
    >
      {/* Card header: checkbox + first 2 key values */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {tipo === 'pesadas' && (
            <button onClick={e => onToggleSeleccion(e, item.id)} className="flex-shrink-0">
              {selected
                ? <CheckSquare size={16} className="text-indigo-500" />
                : <Square size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />}
            </button>
          )}
          {/* Primary identifier — first column */}
          {columnasKeys[0] && (
            <div className="min-w-0">
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {columnasLabels[0]}
              </p>
              <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <RenderCelda item={item} keyName={columnasKeys[0]} isDark={isDark} />
              </div>
            </div>
          )}
        </div>
        {/* Secondary identifier — second column if exists */}
        {columnasKeys[1] && (
          <div className="text-right flex-shrink-0">
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {columnasLabels[1]}
            </p>
            <div className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              <RenderCelda item={item} keyName={columnasKeys[1]} isDark={isDark} />
            </div>
          </div>
        )}
      </div>

      {/* Remaining fields as label: value pairs */}
      {columnasKeys.slice(2).length > 0 && (
        <div className={`grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t text-xs ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
          {columnasKeys.slice(2).map((key, i) => (
            <div key={key} className={i === columnasKeys.slice(2).length - 1 && columnasKeys.slice(2).length % 2 !== 0 ? 'col-span-2' : ''}>
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {columnasLabels[i + 2]}
              </p>
              <div className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                <RenderCelda item={item} keyName={key} isDark={isDark} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {mostrarColumnaAcciones && (
        <div className={`flex gap-2 flex-wrap mt-3 pt-3 border-t ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
          {!soloLectura && (
            <>
              <Guard permissions={`${resourcePrefix}:update`}>
                <button onClick={() => onToggleEstado(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 ${item.estado === 'activo'
                    ? isDark ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200'
                    : isDark ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                  {item.estado === 'activo' ? <><Eye size={13} /> Activo</> : <><EyeOff size={13} /> Inactivo</>}
                </button>
              </Guard>
              <Guard permissions={`${resourcePrefix}:update`}>
                <button onClick={() => onEditar(item)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:scale-105 ${isDark ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                  <Edit2 size={13} /> Editar
                </button>
              </Guard>
              <Guard permissions={`${resourcePrefix}:delete`}>
                <button onClick={() => onEliminar(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:scale-105 ${isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <Trash2 size={13} /> Eliminar 
                </button>
              </Guard>
            </>
          )}
          {tipo === 'pesadas' && (
            <AccionesPesada item={item} isDark={isDark} onSubirPDF={onSubirPDF} onVerDetalles={onVerDetalles} onContenedor={onContenedor} />
          )}
        </div>
      )}
    </div>
  );
});

/* ─── Main component ────────────────────────────────────────────────────── */
const TablaItems = React.memo(({
  items, tipo, columnasKeys, columnasLabels,
  onEditar, onEliminar, onToggleEstado, onSubirPDF, onVerDetalles, onContenedor,
  onGenerarReporte, onEliminarMultiples, soloLectura = false,
  hasMore, loadMore, loadingMore
}) => {
  const { isDark } = useThemeContext();
  const [seleccionadas, setSeleccionadas] = useState(new Set());
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
    try {
      const sel = items.filter(i => seleccionadas.has(i.id));
      if (!sel.length) return;
      await onGenerarReporte?.(sel);
      setSeleccionadas(new Set());
    } catch (err) {
      console.error('Error al generar reporte:', err);
    } finally {
      reporteEnProceso.current = false;
    }
  };

  const handleEliminarSeleccionadas = async () => {
    if (!seleccionadas.size) return;

    const confirmacion = confirm(`¿Eliminar ${seleccionadas.size} operaciones?`);
    if (!confirmacion) return;

    try {
      const ids = items
        .filter(i => seleccionadas.has(i.id))
        .map(i => i.id);

      await onEliminarMultiples?.(ids);

      setSeleccionadas(new Set());
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const todasSeleccionadas = items.length > 0 && seleccionadas.size === items.length;
  const algunaSeleccionada = seleccionadas.size > 0;
  const mostrarColumnaAcciones = !soloLectura || tipo === 'pesadas';

  const sharedRowProps = {
    isDark, tipo, columnasKeys, columnasLabels,
    onToggleSeleccion: handleToggleSeleccion,
    onToggleEstado, onEditar, onEliminar, onSubirPDF, onVerDetalles, onContenedor,
    soloLectura, mostrarColumnaAcciones,
  };

  // --- INFINITE SCROLL LOGIC ---
  const observerTarget = useRef(null);

  React.useEffect(() => {
    if (!hasMore || !loadMore || (tipo !== 'pesadas' && tipo !== 'vehiculos')) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) observer.disconnect();
    };
  }, [hasMore, loadMore, loadingMore, tipo]);

  const sharedRowPropsFull = {
    ...sharedRowProps,
    hasMore, loadMore, loadingMore
  };

  return (
    <div>
      {/* Selection / report bar — pesadas only */}
      {tipo === 'pesadas' && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
          <button
            onClick={toggleTodas}
            className={`flex items-center gap-2 text-sm font-medium transition-all ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {todasSeleccionadas
              ? <CheckSquare size={16} className="text-indigo-500" />
              : <Square size={16} />}
            <span className="hidden xs:inline">{todasSeleccionadas ? 'Deseleccionar todo' : 'Seleccionar todo'}</span>
            {algunaSeleccionada && (
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {seleccionadas.size} selec.
              </span>
            )}
          </button>

          <button
            onClick={handleGenerarReporte}
            disabled={!algunaSeleccionada || reporteEnProceso.current}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm border transition-all active:scale-95 ${algunaSeleccionada && !reporteEnProceso.current
              ? isDark
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/40 cursor-pointer'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 cursor-pointer'
              : 'opacity-30 cursor-not-allowed ' + (isDark ? 'bg-slate-700 border-slate-600 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400')
              }`}
          >
            <FileText size={14} />
            {reporteEnProceso.current ? 'Generando…' : 'Reporte'}
          </button>

          <button
            onClick={handleEliminarSeleccionadas}
            disabled={!algunaSeleccionada}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm border transition-all active:scale-95 ${algunaSeleccionada
                ? isDark
                  ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/40 cursor-pointer'
                  : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 cursor-pointer'
                : 'opacity-30 cursor-not-allowed ' + (isDark
                  ? 'bg-slate-700 border-slate-600 text-slate-500'
                  : 'bg-slate-100 border-slate-200 text-slate-400')
              }`}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      )}

      {/* ── MOBILE: card list (< md) ── */}
      <div className="md:hidden space-y-3 p-4">
        {items.map((item, idx) => (
          <CardItem key={item.id} item={item} idx={idx} selected={seleccionadas.has(item.id)} {...sharedRowPropsFull} />
        ))}
      </div>

      {/* ── DESKTOP: table (md+) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-max">
          <thead>
            <tr className={`${isDark ? 'border-b border-white/10 bg-white/5' : 'border-b border-slate-200 bg-slate-50'}`}>
              {tipo === 'pesadas' && <th className="px-3 py-3 w-8" />}
              {columnasLabels.map(label => (
                <th key={label} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {label}
                </th>
              ))}
              {mostrarColumnaAcciones && (
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <FilaTabla key={item.id} item={item} idx={idx} selected={seleccionadas.has(item.id)} {...sharedRowPropsFull} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Sentinel and Loading Indicators */}
      {(tipo === 'pesadas' || tipo === 'vehiculos') && (
        <div ref={observerTarget} className="py-8 flex flex-col items-center justify-center gap-3">
          {loadingMore && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Cargando más {tipo === 'pesadas' ? 'pesadas' : 'vehículos'}...
              </span>
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              No hay más registros
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
});

export default TablaItems;