import React, { useState, useEffect } from 'react';
import { FileText, Printer, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { ReportePreview } from './ReportePesadas';

const API_BASE_URL = '';

const STORAGE_KEY = 'balanza_user';

// Helper para obtener headers con información del usuario
const getAuthHeaders = (contentType = 'application/json') => {
    const headers = {};
    if (contentType) {
        headers['Content-Type'] = contentType;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.id) {
                headers['x-user-id'] = user.id.toString();
            }
            if (user?.username) {
                headers['x-username'] = user.username;
            }
        }
    } catch {
        // Ignorar errores
    }

    return headers;
};

export default function ReportesHistorial() {
    const { isDark } = useThemeContext();

    const [reportes, setReportes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reporteAbierto, setReporteAbierto] = useState(null);
    const [fechaFiltro, setFechaFiltro] = useState(null);
    const [mesFiltro, setMesFiltro] = useState(null);
    const [anioFiltro, setAnioFiltro] = useState(null);
    const [seleccionados, setSeleccionados] = useState(new Set());
    const anioActual = new Date().getFullYear();
    const aniosDisponibles = Array.from({ length: anioActual - 2019 }, (_, i) => anioActual - i);
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
            const res = await fetch(`${API_BASE_URL}/api/reportes/${id}`, {
                headers: getAuthHeaders(null)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setReporteAbierto(data.data);
        } catch (e) {
            setError(e.message);
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

        const confirmacion = window.confirm(`¿Eliminar ${ids.length} reporte(s)?`);
        if (!confirmacion) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/reportes/delete-masivo`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // 🔥 actualizar UI sin recargar
            setReportes(prev => prev.filter(r => !ids.includes(r.id)));
            setSeleccionados(new Set());

        } catch (e) {
            setError(e.message);
        }
    };

    const formatFecha = (v) => new Date(v).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const formatKg = (v) => v != null
        ? Number(v).toLocaleString('es-AR', { minimumFractionDigits: 0 }) + ' kg'
        : '—';

    const cardClass = `rounded-2xl border shadow-xl transition-all duration-300 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/80 border-slate-200'
        }`;

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

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className={`${cardClass} p-6`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                            <FileText className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Historial de Reportes
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {reportesFiltrados.length}{reportesFiltrados.length !== reportes.length ? ` de ${reportes.length}` : ''} reporte{reportesFiltrados.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Filtros de fecha */}
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { value: null, label: 'Todos' },
                                { value: 'hoy', label: 'Hoy' },
                                { value: 'mes', label: 'Este mes' },
                                { value: 'anio', label: 'Este año' },
                            ].map(f => (
                                <button
                                    key={f.value ?? 'todos'}
                                    onClick={() => { setFechaFiltro(f.value); setMesFiltro(null); setAnioFiltro(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${fechaFiltro === f.value && !anioFiltro
                                        ? 'bg-indigo-600 text-white'
                                        : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >{f.label}</button>
                            ))}
                            <div className={`w-px h-4 ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />
                            <select value={mesFiltro ?? ''} onChange={e => { setMesFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                                className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'} ${mesFiltro ? 'border-indigo-500' : ''}`}>
                                <option value="">Mes</option>
                                {mesesNombres.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                            </select>
                            <select value={anioFiltro ?? ''} onChange={e => { setAnioFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                                className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'} ${anioFiltro ? 'border-indigo-500' : ''}`}>
                                <option value="">Año</option>
                                {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            {(mesFiltro || anioFiltro) && (
                                <button onClick={() => { setMesFiltro(null); setAnioFiltro(null); }}
                                    className={`px-2 py-1 rounded-lg text-xs font-bold ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'}`}>✕</button>
                            )}
                        </div>

                        {seleccionados.size > 0 && (
                            <button
                                onClick={() => eliminarReportes(Array.from(seleccionados))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isDark
                                    ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/40'
                                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                    }`}
                            >
                                Eliminar ({seleccionados.size})
                            </button>
                        )}

                        <button
                            onClick={cargarReportes}
                            className={`p-2 rounded-xl transition-all hover:scale-110 ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                            title="Recargar"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className={`rounded-xl p-4 flex items-center gap-3 border ${isDark ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    <AlertCircle size={18} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Tabla */}
            <div className={`${cardClass} overflow-hidden`}>
                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-3">
                        <Loader2 className="animate-spin text-indigo-500" size={24} />
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Cargando reportes...</span>
                    </div>
                ) : reportesFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 opacity-40">
                        <FileText size={40} />
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            No hay reportes generados todavía
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={isDark ? 'bg-white/5 border-b border-white/10' : 'bg-slate-50 border-b border-slate-200'}>
                                    {['N° Reporte', 'Fecha', 'Pesadas', 'Total Bruto', 'Total Tara', 'Total Neto', 'Acciones'].map(h => (
                                        <th key={h} className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'
                                            }`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reportesFiltrados.map((r, idx) => (
                                    <tr
                                        key={r.id}
                                        className={`transition-all duration-200 border-b ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'
                                            }`}
                                        style={{ animation: `fadeInRow 0.2s ease-out ${idx * 0.03}s both` }}
                                    >

                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={seleccionados.has(r.id)}
                                                onChange={() => toggleSeleccion(r.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-lg font-mono font-bold text-sm ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                {String(r.numero_reporte).padStart(6, '0')}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 font-mono text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                            {formatFecha(r.created_at)}
                                        </td>
                                        <td className={`px-6 py-4 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                            {r.cantidad_pesadas}
                                        </td>
                                        <td className={`px-6 py-4 font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                            {formatKg(r.total_bruto)}
                                        </td>
                                        <td className={`px-6 py-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {formatKg(r.total_tara)}
                                        </td>
                                        <td className={`px-6 py-4 font-bold text-base ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                                            {formatKg(r.total_neto)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => abrirReporte(r.id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105 ${isDark
                                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/40'
                                                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                                    }`}
                                            >
                                                <Printer size={14} />
                                                Reimprimir
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Preview al reimprimir */}
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

            <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}