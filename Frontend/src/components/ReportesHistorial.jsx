import React, { useState, useEffect } from 'react';
import { FileBarChart, Printer, RefreshCw, Trash2, X } from 'lucide-react';
import { ReportePreview } from './ReportePesadas';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import { formatFecha } from '../lib/format';
import { useConfirm, useToast } from '../context/feedback';
import Guard from './Guard';
import PageHeader from './ui/PageHeader';
import { Card } from './ui/Card';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import Segmented from './ui/Segmented';
import EmptyState from './ui/EmptyState';
import { LoadingState } from './ui/Spinner';
import { controlClass } from './ui/controlClass';
import { cx } from '../lib/cx';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function ReportesHistorial() {
    const confirm = useConfirm();
    const toast = useToast();

    const [reportes, setReportes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reporteAbierto, setReporteAbierto] = useState(null);
    const [abriendo, setAbriendo] = useState(null);
    const [fechaFiltro, setFechaFiltro] = useState(null);
    const [mesFiltro, setMesFiltro] = useState(null);
    const [anioFiltro, setAnioFiltro] = useState(null);
    const [seleccionados, setSeleccionados] = useState(new Set());
    const anioActual = new Date().getFullYear();
    const aniosDisponibles = Array.from({ length: anioActual - 2019 }, (_, i) => anioActual - i);

    useEffect(() => {
        cargarReportes();
    }, []);

    const cargarReportes = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE_URL}/api/reportes`, {
                headers: getAuthHeaders(null)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setReportes(data.data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const abrirReporte = async (id) => {
        try {
            setAbriendo(id);
            const res = await fetch(`${API_BASE_URL}/api/reportes/${id}`, {
                headers: getAuthHeaders(null)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setReporteAbierto(data.data);
        } catch (e) {
            setError(e.message);
        } finally {
            setAbriendo(null);
        }
    };

    const toggleSeleccion = (id) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const eliminarReportes = async (ids) => {
        if (!ids.length) return;

        const ok = await confirm({
            title: 'Eliminar reportes',
            message: `Se eliminan ${ids.length} reporte${ids.length !== 1 ? 's' : ''} del historial. Las pesadas no se modifican.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
        });
        if (!ok) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/reportes/delete-masivo`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Actualizar la UI sin recargar
            setReportes(prev => prev.filter(r => !ids.includes(r.id)));
            setSeleccionados(new Set());
            toast.success(`${ids.length} reporte${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`);
        } catch (e) {
            setError(e.message);
        }
    };

    const formatKg = (v) => v != null
        ? Number(v).toLocaleString('es-AR', { minimumFractionDigits: 0 }) + ' kg'
        : '—';

    const now = new Date();
    const reportesFiltrados = reportes.filter(r => {
        const d = new Date(r.created_at);
        // Filtro específico mes/año tiene prioridad
        if (anioFiltro && mesFiltro) return d.getFullYear() === anioFiltro && (d.getMonth() + 1) === mesFiltro;
        if (anioFiltro) return d.getFullYear() === anioFiltro;
        if (!fechaFiltro) return true;
        if (fechaFiltro === 'hoy') return d.toDateString() === now.toDateString();
        if (fechaFiltro === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (fechaFiltro === 'anio') return d.getFullYear() === now.getFullYear();
        return true;
    });

    const visiblesIds = reportesFiltrados.map(r => r.id);
    const todosVisibles = visiblesIds.length > 0 && visiblesIds.every(id => seleccionados.has(id));
    const toggleTodos = () => setSeleccionados(todosVisibles ? new Set() : new Set(visiblesIds));
    const hayFiltros = Boolean(fechaFiltro || mesFiltro || anioFiltro);

    return (
        <div>
            <PageHeader
                title="Reportes"
                description="Reportes de pesadas generados desde el historial. Se pueden reimprimir."
                meta={!loading && (
                    <Badge>
                        {reportesFiltrados.length}{reportesFiltrados.length !== reportes.length ? ` de ${reportes.length}` : ''} reporte{reportesFiltrados.length !== 1 ? 's' : ''}
                    </Badge>
                )}
                actions={(
                    <Button icon={RefreshCw} onClick={cargarReportes} loading={loading}>Actualizar</Button>
                )}
            />

            {error && <Alert tone="danger" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 border-b border-line">
                    <Segmented
                        label="Fecha"
                        value={anioFiltro ? '__especifico' : fechaFiltro}
                        onChange={(v) => { setFechaFiltro(v); setMesFiltro(null); setAnioFiltro(null); }}
                        options={[
                            { value: null, label: 'Todos' },
                            { value: 'hoy', label: 'Hoy' },
                            { value: 'mes', label: 'Este mes' },
                            { value: 'anio', label: 'Este año' },
                        ]}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-fg-subtle">Período</span>
                        <select value={mesFiltro ?? ''} aria-label="Mes"
                            onChange={e => { setMesFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                            className={cx(controlClass, 'h-8 w-auto text-xs', mesFiltro && 'border-brand-solid')}>
                            <option value="">Mes</option>
                            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select value={anioFiltro ?? ''} aria-label="Año"
                            onChange={e => { setAnioFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                            className={cx(controlClass, 'h-8 w-auto text-xs', anioFiltro && 'border-brand-solid')}>
                            <option value="">Año</option>
                            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        {(mesFiltro || anioFiltro) && (
                            <Button size="sm" variant="ghost" icon={X} onClick={() => { setMesFiltro(null); setAnioFiltro(null); }}>Quitar</Button>
                        )}
                    </div>
                    {mesFiltro && !anioFiltro && (
                        <p className="w-full text-xs text-fg-subtle">Elegí también el año para filtrar por mes.</p>
                    )}
                    {seleccionados.size > 0 && (
                        <Guard permissions="reportes:delete">
                            <Button size="sm" variant="danger-soft" icon={Trash2} className="ml-auto" onClick={() => eliminarReportes(Array.from(seleccionados))}>
                                Eliminar ({seleccionados.size})
                            </Button>
                        </Guard>
                    )}
                </div>

                {loading ? (
                    <LoadingState texto="Cargando reportes..." />
                ) : reportesFiltrados.length === 0 ? (
                    <EmptyState
                        icon={FileBarChart}
                        title={hayFiltros && reportes.length ? 'No hay reportes en este período' : 'Todavía no hay reportes'}
                        description={hayFiltros && reportes.length
                            ? 'Cambiá el filtro de fecha para ver otros reportes.'
                            : 'Se generan desde el historial de pesadas: seleccioná operaciones y tocá "Generar reporte".'}
                    />
                ) : (
                    <>
                        {/* Móvil */}
                        <ul className="md:hidden divide-y divide-line">
                            {reportesFiltrados.map(r => (
                                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                                    <input type="checkbox" checked={seleccionados.has(r.id)} onChange={() => toggleSeleccion(r.id)}
                                        aria-label={`Seleccionar reporte ${r.numero_reporte}`} className="mt-1 h-5 w-5 accent-[var(--brand-solid)]" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-mono text-sm font-semibold text-fg">N° {String(r.numero_reporte).padStart(6, '0')}</p>
                                        <p className="text-xs text-fg-subtle tabular">{formatFecha(r.created_at)} · {r.cantidad_pesadas} pesadas</p>
                                        <p className="mt-1 text-sm text-fg tabular">Neto <strong>{formatKg(r.total_neto)}</strong></p>
                                    </div>
                                    <Button size="sm" icon={Printer} onClick={() => abrirReporte(r.id)} loading={abriendo === r.id}>Ver</Button>
                                </li>
                            ))}
                        </ul>

                        {/* Escritorio */}
                        <div className="hidden md:block relative overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-2">
                                    <tr className="border-b border-line">
                                        <th className="w-10 pl-4 pr-1">
                                            <input type="checkbox" checked={todosVisibles} onChange={toggleTodos}
                                                aria-label="Seleccionar todos los reportes visibles" className="h-4 w-4 accent-[var(--brand-solid)]" />
                                        </th>
                                        {[['N° reporte'], ['Fecha'], ['Pesadas', true], ['Total bruto', true], ['Total tara', true], ['Total neto', true], ['Acciones', true]].map(([h, der]) => (
                                            <th key={h} scope="col" className={cx('px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle whitespace-nowrap', der ? 'text-right' : 'text-left')}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportesFiltrados.map(r => (
                                        <tr key={r.id} className={cx('border-b border-line last:border-b-0', seleccionados.has(r.id) ? 'bg-brand-soft/60' : 'hover:bg-surface-2')}>
                                            <td className="pl-4 pr-1 py-2.5">
                                                <input type="checkbox" checked={seleccionados.has(r.id)} onChange={() => toggleSeleccion(r.id)}
                                                    aria-label={`Seleccionar reporte ${r.numero_reporte}`} className="h-4 w-4 accent-[var(--brand-solid)]" />
                                            </td>
                                            <td className="px-4 py-2.5 font-mono font-semibold text-fg">{String(r.numero_reporte).padStart(6, '0')}</td>
                                            <td className="px-4 py-2.5 text-xs text-fg-muted tabular whitespace-nowrap">{formatFecha(r.created_at)}</td>
                                            <td className="px-4 py-2.5 text-right tabular text-fg">{r.cantidad_pesadas}</td>
                                            <td className="px-4 py-2.5 text-right tabular text-fg">{formatKg(r.total_bruto)}</td>
                                            <td className="px-4 py-2.5 text-right tabular text-fg-muted">{formatKg(r.total_tara)}</td>
                                            <td className="px-4 py-2.5 text-right tabular font-semibold text-fg">{formatKg(r.total_neto)}</td>
                                            <td className="px-4 py-2 text-right">
                                                <Button size="sm" variant="ghost" icon={Printer} onClick={() => abrirReporte(r.id)} loading={abriendo === r.id}>
                                                    Ver / reimprimir
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Card>

            {/* Vista previa al reimprimir */}
            {reporteAbierto && (
                <ReportePreview
                    pesadas={reporteAbierto.pesadas_data}
                    numeroReporte={reporteAbierto.numero_reporte}
                    fechaEmision={new Date(reporteAbierto.created_at).toLocaleString('es-AR')}
                    guardando={false}
                    errorGuardar={null}
                    onClose={() => setReporteAbierto(null)}
                />
            )}
        </div>
    );
}
