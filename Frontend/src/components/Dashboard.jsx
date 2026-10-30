import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Scale, ClipboardList, Truck, Timer, RefreshCw, CalendarDays, Route, Tractor, Package, IdCard, BarChart3, AlertCircle } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import PageHeader from './ui/PageHeader';
import { Card, CardHeader, CardBody } from './ui/Card';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import { LoadingState } from './ui/Spinner';
import { Select } from './ui/Field';
import { cx } from '../lib/cx';
import EnVivo from './EnVivo';

/* ─── Formato ─────────────────────────────────────────────────────────────── */
const kgCompleto = (kg) => `${Math.round(Number(kg) || 0).toLocaleString('es-AR')} kg`;

// < 1 t en kg; desde 1 t en toneladas (con la unidad siempre explícita)
const formatPeso = (kg) => {
  const v = Number(kg);
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1000) return `${Math.round(v).toLocaleString('es-AR')} kg`;
  return `${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: v >= 100000 ? 0 : 1 })} t`;
};

const formatNumero = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-AR') : '—');

/* ─── Indicador ───────────────────────────────────────────────────────────── */
function Kpi({ icon: Icon, label, value, detail, title, tone = 'brand' }) {
  const tonos = {
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-surface-3 text-fg-muted',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        <div className={cx('rounded-lg p-2', tonos[tone])}>
          <Icon size={18} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-fg tabular" title={title}>{value}</p>
      {detail && <p className="mt-1 text-sm text-fg-subtle">{detail}</p>}
    </Card>
  );
}

/* ─── Ranking con barras simples ──────────────────────────────────────────── */
function Ranking({ items, valueKey = 'pesoNeto', formatValue = formatPeso, detailFn, vacio = 'Sin datos este mes' }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-fg-subtle">{vacio}</p>;
  const max = Math.max(...items.map(i => Number(i[valueKey]) || 0), 1);
  return (
    <ol className="space-y-3">
      {items.map((item, i) => {
        const valor = Number(item[valueKey]) || 0;
        return (
          <li key={`${item.nombre}-${i}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-4 shrink-0 text-xs font-semibold text-fg-subtle tabular">{i + 1}</span>
                <span className="truncate font-medium text-fg" title={item.nombre}>{item.nombre || 'Sin nombre'}</span>
              </span>
              <span className="shrink-0 font-semibold text-fg tabular" title={valueKey === 'pesoNeto' ? kgCompleto(valor) : undefined}>
                {formatValue(valor)}
              </span>
            </div>
            <div className="mt-1.5 ml-6 h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-solid" style={{ width: `${Math.max((valor / max) * 100, 2)}%` }} />
            </div>
            {detailFn && <p className="mt-1 ml-6 text-xs text-fg-subtle">{detailFn(item)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Mapa de actividad por hora ──────────────────────────────────────────── */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 24 }, (_, i) => i);

function ActividadSemanal({ data }) {
  const max = Math.max(...data.map(d => d.total), 0);
  const nivel = (total) => {
    if (!total) return 'bg-surface-3';
    const r = total / max;
    if (r <= 0.25) return 'bg-brand-solid/25';
    if (r <= 0.5) return 'bg-brand-solid/50';
    if (r <= 0.75) return 'bg-brand-solid/75';
    return 'bg-brand-solid';
  };

  if (!max) return <p className="py-8 text-center text-sm text-fg-subtle">Sin pesadas en los últimos 7 días</p>;

  return (
    <div className="relative overflow-x-auto">
      <table className="min-w-[640px] w-full border-separate border-spacing-[3px]">
        <caption className="sr-only">Cantidad de pesadas por día y hora, últimos 7 días</caption>
        <thead>
          <tr>
            <th className="w-10" />
            {HORAS.map(h => (
              <th key={h} scope="col" className="text-[10px] font-medium text-fg-subtle tabular">{h % 3 === 0 ? h : ''}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIAS.map((d, dia) => (
            <tr key={d}>
              <th scope="row" className="pr-2 text-left text-xs font-medium text-fg-muted">{d}</th>
              {HORAS.map(h => {
                const total = data.find(item => item.dia === dia && item.hora === h)?.total ?? 0;
                return (
                  <td key={h} className={cx('h-5 rounded-sm', nivel(total))} title={`${d} ${h}:00 — ${total} pesada${total !== 1 ? 's' : ''}`}>
                    <span className="sr-only">{total}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-fg-subtle">
        Menos
        {['bg-surface-3', 'bg-brand-solid/25', 'bg-brand-solid/50', 'bg-brand-solid/75', 'bg-brand-solid'].map(c => (
          <span key={c} className={cx('h-3 w-3 rounded-sm', c)} aria-hidden="true" />
        ))}
        Más
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isDark } = useThemeContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  // Usuarios globales (superadmin, logística): total de todas sus localidades o una en particular
  const { isGlobal } = useAuth();
  const [localidades, setLocalidades] = useState([]);
  const [localidadFiltro, setLocalidadFiltro] = useState('');
  const pedido = useRef(0);   // descarta respuestas viejas si se cambia el filtro rápido

  useEffect(() => {
    if (!isGlobal) return;
    fetch(`${API_BASE_URL}/api/localidades`, { headers: getAuthHeaders(null) })
      .then(res => res.json())
      .then(data => { if (data.success) setLocalidades(data.data); })
      .catch(() => { /* sin filtro: se ve el total */ });
  }, [isGlobal]);

  const fetchMetricas = useCallback(async () => {
    const id = ++pedido.current;
    try {
      const qs = localidadFiltro ? `?localidad_id=${localidadFiltro}` : '';
      const response = await fetch(`${API_BASE_URL}/api/metricas/dashboard${qs}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (id !== pedido.current) return;

      if (data.success) {
        setMetricas(data.data);
        setError(null);
        setActualizado(new Date());
      } else {
        setError(data.error || 'Error al cargar métricas');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor');
      console.error('Error:', err);
    } finally {
      if (id === pedido.current) setLoading(false);
    }
  }, [localidadFiltro]);

  // Carga inicial y actualización cada 30 segundos
  useEffect(() => {
    fetchMetricas();
    const interval = setInterval(fetchMetricas, 30000);
    return () => clearInterval(interval);
  }, [fetchMetricas]);

  const refrescar = async () => {
    setRefrescando(true);
    await fetchMetricas();
    setRefrescando(false);
  };

  const hoyLargo = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoyTexto = hoyLargo.charAt(0).toUpperCase() + hoyLargo.slice(1);

  if (loading) return <LoadingState texto="Cargando indicadores..." />;

  if (error && !metricas) {
    return (
      <Card className="max-w-xl mx-auto">
        <EmptyState
          icon={AlertCircle}
          title="No se pudieron cargar los indicadores"
          description={error}
          action={<Button variant="primary" icon={RefreshCw} onClick={refrescar} loading={refrescando}>Reintentar</Button>}
        />
      </Card>
    );
  }

  if (!metricas) return null;
  const {
    hoy = {},
    semana = [],
    topProductores = [],
    topProductos = [],
    topTransportes = [],
    topChoferes = [],
    distribucionVehiculos = [],
    estadisticasMes = {},
    actividadHeatmap = [],
    eficiencia = { promedioMinutos: 0 }
  } = metricas;

  // Neto de las operaciones cerradas hoy (un bruto sin tara todavía no tiene neto)
  const netoHoy = hoy.neto || 0;

  const datosSemana = semana.map(d => ({
    ...d,
    fecha: d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }) : ''
  }));

  const ejes = isDark ? '#8792a6' : '#64748b';
  const grilla = isDark ? '#24314a' : '#e2e8f0';
  const colorBruto = isDark ? '#4ade80' : '#059669';
  const colorTara = isDark ? '#7fb0ff' : '#1d4ed8';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={hoyTexto}
        actions={(
          <>
            {isGlobal && localidades.length > 0 && (
              <Select
                value={localidadFiltro}
                onChange={(e) => setLocalidadFiltro(e.target.value)}
                aria-label="Localidad"
                className="h-8 !w-56 text-sm"
              >
                <option value="">Todas las localidades</option>
                {localidades.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </Select>
            )}
            {actualizado && (
              <span className="text-xs text-fg-subtle">
                Actualizado {actualizado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button size="sm" icon={RefreshCw} onClick={refrescar} loading={refrescando}>Actualizar</Button>
          </>
        )}
        className="mb-0"
      />

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-warning">
          <AlertCircle size={16} aria-hidden="true" /> No se pudo actualizar: {error}. Se muestran los últimos datos obtenidos.
        </p>
      )}

      {/* En vivo: usuarios globales ven qué pasa ahora en cada localidad */}
      {isGlobal && <EnVivo localidadFiltro={localidadFiltro} />}

      {/* Hoy */}
      <section aria-labelledby="titulo-hoy">
        <h2 id="titulo-hoy" className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-subtle">Hoy</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Scale} label="Neto del día" value={formatPeso(netoHoy)} title={kgCompleto(netoHoy)}
            detail={hoy.operacionesAbiertas
              ? `Operaciones cerradas · ${formatNumero(hoy.operacionesAbiertas)} en curso`
              : `Bruto ${formatPeso(hoy.bruto)} · Tara ${formatPeso(hoy.tara)}`} />
          <Kpi icon={ClipboardList} label="Pesadas registradas" value={formatNumero(hoy.pesadas)} tone="neutral"
            detail="Brutos y taras del día" />
          <Kpi icon={Truck} label="Operaciones iniciadas" value={formatNumero(hoy.operaciones)} tone={hoy.operacionesAbiertas ? 'warning' : 'success'}
            detail={hoy.operacionesAbiertas
              ? `${formatNumero(hoy.operacionesAbiertas)} abierta${hoy.operacionesAbiertas !== 1 ? 's' : ''}, esperando la segunda pesada`
              : 'Todas completas'} />
          <Kpi icon={Timer} label="Tiempo promedio en planta" value={eficiencia.promedioMinutos ? `${eficiencia.promedioMinutos} min` : '—'} tone="neutral"
            detail="Entre bruto y tara, este mes" />
        </div>
      </section>

      {/* Semana + mes */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader icon={BarChart3} title="Últimos 7 días" description="Peso bruto y tara registrados por día" />
          <CardBody>
            {datosSemana.length === 0 ? (
              <p className="py-16 text-center text-sm text-fg-subtle">Sin pesadas en los últimos 7 días</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={datosSemana} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grilla} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: ejes }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 12, fill: ejes }}
                      tickFormatter={(v) => `${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: 0 })} t`}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#111a2b' : '#fff',
                        border: `1px solid ${grilla}`,
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: ejes, marginBottom: 4 }}
                      formatter={(value, name) => [kgCompleto(value), name === 'bruto' ? 'Bruto' : 'Tara']}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={28}
                      iconType="circle"
                      formatter={(value) => <span style={{ fontSize: 12, color: ejes }}>{value === 'bruto' ? 'Bruto' : 'Tara'}</span>}
                    />
                    <Area type="monotone" dataKey="bruto" name="bruto" stroke={colorBruto} strokeWidth={2} fill={colorBruto} fillOpacity={0.12} isAnimationActive={false} />
                    <Area type="monotone" dataKey="tara" name="tara" stroke={colorTara} strokeWidth={2} fill={colorTara} fillOpacity={0.1} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={CalendarDays} title="Este mes" description="Acumulado desde el día 1" />
          <CardBody>
            <dl className="divide-y divide-line">
              {[
                ['Operaciones', formatNumero(estadisticasMes.totalOperaciones)],
                ['Pesadas', formatNumero(estadisticasMes.totalPesadas)],
                ['Carga neta', formatPeso(estadisticasMes.totalNeto), kgCompleto(estadisticasMes.totalNeto)],
                ['Carga promedio por operación', formatPeso(estadisticasMes.cargaPromedio), kgCompleto(estadisticasMes.cargaPromedio)],
              ].map(([k, v, t]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <dt className="text-sm text-fg-muted">{k}</dt>
                  <dd className="text-lg font-semibold text-fg tabular" title={t}>{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* Rankings del mes */}
      <section aria-labelledby="titulo-mes">
        <h2 id="titulo-mes" className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-subtle">Ranking del mes</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader icon={Route} title="Transportes" description="Carga neta movida" />
            <CardBody><Ranking items={topTransportes.slice(0, 5)} detailFn={t => `${formatNumero(t.operaciones)} operaciones`} /></CardBody>
          </Card>
          <Card>
            <CardHeader icon={Tractor} title="Productores" description="Carga neta" />
            <CardBody><Ranking items={topProductores.slice(0, 5)} detailFn={p => `${formatNumero(p.operaciones)} operaciones`} /></CardBody>
          </Card>
          <Card>
            <CardHeader icon={Package} title="Productos" description="Carga neta por mercadería" />
            <CardBody><Ranking items={topProductos.slice(0, 5)} detailFn={p => `${formatNumero(p.totalPesadas)} pesadas`} /></CardBody>
          </Card>
          <Card>
            <CardHeader icon={Truck} title="Tipos de vehículo" description="Carga neta por tipo" />
            <CardBody>
              <Ranking
                items={distribucionVehiculos.map(v => ({ ...v, nombre: (v.tipo || 'OTRO').replace(/_/g, ' ') }))}
                detailFn={v => `${formatNumero(v.operaciones)} operaciones`}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={IdCard} title="Choferes" description="Operaciones realizadas" />
            <CardBody>
              <Ranking
                items={topChoferes.slice(0, 5)}
                valueKey="operaciones"
                formatValue={(v) => `${formatNumero(v)} op.`}
                detailFn={c => `Carga neta ${formatPeso(c.pesoNeto)}`}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Actividad */}
      <Card>
        <CardHeader icon={CalendarDays} title="Actividad por hora" description="Pesadas por día y hora, últimos 7 días" />
        <CardBody><ActividadSemanal data={actividadHeatmap} /></CardBody>
      </Card>
    </div>
  );
}
