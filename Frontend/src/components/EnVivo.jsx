import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Truck, Clock, ListChecks, WifiOff } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import { Card, CardHeader, CardBody } from './ui/Card';
import Badge from './ui/Badge';
import { cx } from '../lib/cx';

// Peso a partir del cual se considera que hay un camión sobre la balanza
const UMBRAL_PESANDO_KG = 200;
const REFRESCO_MS = 8000;

// Un color fijo por localidad (por id), legible en claro y oscuro. Siempre va junto al nombre.
const COLORES = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];
export const colorLocalidad = (id) => COLORES[(Number(id) || 0) % COLORES.length];

const kg = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Math.round(Number(v)).toLocaleString('es-AR')} kg`);

const hace = (fecha) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
};

const hora = (fecha) => new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
const esHoy = (fecha) => new Date(fecha).toDateString() === new Date().toDateString();

const wsUrl = () => `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?todas=1`;

export function LocalidadTag({ id, nombre }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorLocalidad(id) }} />
      <span className="truncate">{nombre}</span>
    </span>
  );
}

/* Peso en vivo de todas las balanzas del alcance, por WebSocket: { [dispositivo_id]: { peso, stable, connected } } */
function usePesosEnVivo() {
  const [pesos, setPesos] = useState({});
  useEffect(() => {
    let cerrado = false;
    let timer = null;
    let socket = null;
    const conectar = () => {
      socket = new WebSocket(wsUrl());
      socket.onmessage = (event) => {
        const d = JSON.parse(event.data);
        if (!d.dispositivo_id) return;
        setPesos((prev) => {
          const actual = prev[d.dispositivo_id] || {};
          if (d.type === 'STATUS') {
            return { ...prev, [d.dispositivo_id]: {
              ...actual,
              connected: d.status === 'CONNECTED',
              ...('currentWeight' in d && { peso: d.currentWeight }),
              stable: d.status === 'CONNECTED' && d.stable === true,
            } };
          }
          if (d.type === 'WEIGHT') {
            return { ...prev, [d.dispositivo_id]: { ...actual, connected: true, peso: d.weight, stable: d.stable === true } };
          }
          return prev;
        });
      };
      socket.onclose = () => {
        if (cerrado) return;
        setPesos({});
        timer = setTimeout(conectar, 3000);
      };
      socket.onerror = () => socket.close();
    };
    conectar();
    return () => { cerrado = true; clearTimeout(timer); socket?.close(); };
  }, []);
  return pesos;
}

function EstadoBalanza({ balanza }) {
  if (!balanza) return <Badge tone="neutral">Sin balanza</Badge>;
  if (!balanza.connected) return <Badge tone="danger" icon={WifiOff}>Sin conexión</Badge>;
  if ((balanza.peso ?? 0) >= UMBRAL_PESANDO_KG) return <Badge tone="warning" dot>Pesando</Badge>;
  return <Badge tone="success" dot>Libre</Badge>;
}

function TarjetaLocalidad({ loc, pesos }) {
  // Datos del REST como base; el WebSocket los pisa en tiempo real
  const balanzas = loc.balanzas.map((b) => ({ ...b, ...(pesos[b.dispositivo_id] || {}) }));
  const principal = balanzas.find((b) => (b.peso ?? 0) >= UMBRAL_PESANDO_KG) || balanzas[0];
  const pesando = balanzas.some((b) => b.connected && (b.peso ?? 0) >= UMBRAL_PESANDO_KG);

  return (
    <Card
      className={cx('overflow-hidden border-l-4', pesando && 'ring-2 ring-warning-solid/40')}
      style={{ borderLeftColor: colorLocalidad(loc.id) }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h3 className="min-w-0 text-sm font-semibold text-fg"><LocalidadTag id={loc.id} nombre={loc.nombre} /></h3>
        <EstadoBalanza balanza={principal} />
      </div>

      <div className="px-4 pt-2 pb-3">
        <p className={cx('text-3xl font-semibold tracking-tight tabular', principal?.connected ? 'text-fg' : 'text-fg-subtle')}>
          {principal?.connected ? kg(principal.peso ?? 0) : '—'}
        </p>
        <p className="mt-0.5 text-xs text-fg-subtle">
          {principal?.connected
            ? (principal.stable ? 'Peso estable' : 'Peso en movimiento')
            : 'Sin lectura de balanza'}
          {balanzas.length > 1 && ` · ${balanzas.length} balanzas`}
        </p>
      </div>

      <div className="border-t border-line px-4 py-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-fg-muted">Hoy</span>
          <span className="font-medium text-fg tabular">
            {loc.hoy.pesadas} pesada{loc.hoy.pesadas !== 1 ? 's' : ''} · neto {kg(loc.hoy.neto)}
          </span>
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          <Truck size={13} aria-hidden="true" /> En planta ({loc.abiertas.length})
        </p>
        {loc.abiertas.length === 0 ? (
          <p className="text-sm text-fg-subtle">Ningún camión esperando la segunda pesada</p>
        ) : (
          <ul className="space-y-2">
            {loc.abiertas.slice(0, 4).map((o) => (
              <li key={o.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-fg">{o.patente}</span>
                  <span className="text-fg tabular">{kg(o.bruto)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs text-fg-subtle">
                  <span className="truncate">{[o.chofer, o.producto].filter(Boolean).join(' · ') || o.sentido}</span>
                  <span className="shrink-0 inline-flex items-center gap-1"><Clock size={11} aria-hidden="true" />{hace(o.desde)}</span>
                </div>
              </li>
            ))}
            {loc.abiertas.length > 4 && <li className="text-xs text-fg-subtle">y {loc.abiertas.length - 4} más</li>}
          </ul>
        )}
      </div>
    </Card>
  );
}

function UltimasPesadas({ items, nombres }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-fg-subtle">Todavía no hay pesadas</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Últimas pesadas de todas las localidades</caption>
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            <th scope="col" className="pb-2 pr-3">Hora</th>
            <th scope="col" className="pb-2 pr-3">Localidad</th>
            <th scope="col" className="pb-2 pr-3">Patente</th>
            <th scope="col" className="pb-2 pr-3">Tipo</th>
            <th scope="col" className="pb-2 pr-3 text-right">Peso</th>
            <th scope="col" className="pb-2">Chofer · Producto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-3 text-fg-muted tabular whitespace-nowrap" title={new Date(p.fecha_hora).toLocaleString('es-AR')}>
                {esHoy(p.fecha_hora) ? hora(p.fecha_hora) : new Date(p.fecha_hora).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              </td>
              <td className="py-2 pr-3 font-medium text-fg"><LocalidadTag id={p.localidad_id} nombre={nombres.get(p.localidad_id) || `Localidad ${p.localidad_id}`} /></td>
              <td className="py-2 pr-3 font-semibold text-fg">{p.vehiculo_patente}</td>
              <td className="py-2 pr-3">
                <Badge size="sm" tone={p.tipo === 'BRUTO' ? 'ingreso' : 'salida'}>{p.tipo === 'BRUTO' ? 'Bruto' : 'Tara'}</Badge>
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-fg tabular">{kg(p.peso)}</td>
              <td className="py-2 text-fg-muted"><span className="block max-w-[260px] truncate">{[p.chofer, p.producto].filter(Boolean).join(' · ')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Panel "En vivo" del dashboard (usuarios globales): una tarjeta por localidad + últimas pesadas */
export default function EnVivo({ localidadFiltro }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const pedido = useRef(0);
  const pesos = usePesosEnVivo();

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    try {
      const qs = localidadFiltro ? `?localidad_id=${localidadFiltro}` : '';
      const res = await fetch(`${API_BASE_URL}/api/metricas/en-vivo${qs}`, { headers: getAuthHeaders(null) });
      const data = await res.json();
      if (id !== pedido.current) return;
      if (data.success) { setDatos(data.data); setError(null); }
      else setError(data.error || 'No se pudo cargar');
    } catch {
      if (id === pedido.current) setError('Sin conexión con el servidor');
    }
  }, [localidadFiltro]);

  useEffect(() => {
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  if (!datos) {
    return error ? <p role="alert" className="text-sm text-warning">En vivo: {error}</p> : null;
  }

  const nombres = new Map(datos.localidades.map((l) => [l.id, l.nombre]));
  const pesandoAhora = datos.localidades.filter((l) =>
    l.balanzas.some((b) => { const v = { ...b, ...(pesos[b.dispositivo_id] || {}) }; return v.connected && (v.peso ?? 0) >= UMBRAL_PESANDO_KG; })
  ).length;
  const enPlanta = datos.localidades.reduce((n, l) => n + l.abiertas.length, 0);

  return (
    <section aria-labelledby="titulo-en-vivo" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="titulo-en-vivo" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-subtle">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-solid opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger-solid" />
          </span>
          En vivo
        </h2>
        <span className="text-sm text-fg-muted">
          {pesandoAhora ? `${pesandoAhora} localidad${pesandoAhora !== 1 ? 'es' : ''} pesando ahora` : 'Ninguna balanza pesando'}
          {` · ${enPlanta} ${enPlanta === 1 ? 'camión' : 'camiones'} en planta`}
        </span>
        {error && <span role="alert" className="text-xs text-warning">({error}; datos de hace unos segundos)</span>}
      </div>

      {datos.localidades.length === 0 ? (
        <p className="text-sm text-fg-subtle">No hay localidades en tu alcance</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {datos.localidades.map((loc) => <TarjetaLocalidad key={loc.id} loc={loc} pesos={pesos} />)}
        </div>
      )}

      <Card>
        <CardHeader icon={ListChecks} title="Últimas pesadas" description="De todas las localidades, la más reciente primero" />
        <CardBody><UltimasPesadas items={datos.ultimas} nombres={nombres} /></CardBody>
      </Card>
    </section>
  );
}

