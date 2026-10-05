import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, Loader2, Truck } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';

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

export default function ReportePesadas({ pesadas, onClose }) {
    const { isDark } = useThemeContext();
    const [guardando, setGuardando] = useState(true);
    const [errorGuardar, setErrorGuardar] = useState(null);
    const [reporte, setReporte] = useState(null);
    const yaGuardado = useRef(false); // ⭐ Flag para evitar dobles guardados

    // Guardar automáticamente al montar (solo UNA vez)
    useEffect(() => {
        if (!yaGuardado.current) {
            yaGuardado.current = true;
            guardarReporte();
        }
    }, []);

    const guardarReporte = async () => {
        try {
            setGuardando(true);
            setErrorGuardar(null);
            const res = await fetch(`${API_BASE_URL}/api/reportes`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ pesadas })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar reporte');
            setReporte(data.data);
        } catch (e) {
            setErrorGuardar(e.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ReportePreview
            pesadas={pesadas}
            numeroReporte={reporte?.numero_reporte}
            fechaEmision={reporte?.created_at ? new Date(reporte.created_at).toLocaleString('es-AR') : new Date().toLocaleString('es-AR')}
            guardando={guardando}
            errorGuardar={errorGuardar}
            onClose={onClose}
            isDark={isDark}
        />
    );
}

// ─── Preview reutilizable (usado tanto en ReportePesadas como en historial) ──
export function ReportePreview({ pesadas, numeroReporte, fechaEmision, guardando, errorGuardar, onClose, isDark: isDarkProp }) {
    const ctx = useThemeContext();
    const isDark = isDarkProp !== undefined ? isDarkProp : ctx.isDark;
    const [paraCamionero, setParaCamionero] = useState(false);

    const formatP = (v) => v != null
        ? Number(v).toLocaleString('es-AR', { minimumFractionDigits: 0 }) + ' kg'
        : '—';

    const formatF = (v) => v
        ? new Date(v).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        })
        : '—';

    const totalBruto = pesadas.reduce((acc, p) => acc + (Number(p.bruto) || 0), 0);
    const totalTara = pesadas.reduce((acc, p) => acc + (Number(p.tara) || 0), 0);
    const totalNeto = pesadas.reduce((acc, p) => acc + (Number(p.neto) || 0), 0);

    const handlePrint = (esCamionero) => {
        const nroLabel = numeroReporte
            ? `N° ${String(numeroReporte).padStart(6, '0')}`
            : '';

        const normales    = pesadas.filter(p => !p.es_contenedor);
        const contenedores = pesadas.filter(p => p.es_contenedor);

        const filasNormales = normales.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="text-align:center;color:#94a3b8">${i + 1}</td>
        <td><span style="padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;background:${p.sentido === 'SALIDA' ? '#fed7aa' : '#dbeafe'};color:${p.sentido === 'SALIDA' ? '#9a3412' : '#1e40af'}">${p.sentido === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}</span></td>
        <td style="font-family:monospace;font-weight:700">${p.vehiculo_patente || '—'}</td>
        <td>${formatF(p.fecha_entrada)}</td>
        <td>${formatF(p.fecha_salida)}</td>
        <td>${p.productor || '—'}</td>
        <td>${p.producto || '—'}</td>
        <td>${p.nro_remito || '—'}</td>
        <td style="font-weight:700;color:#15803d">${formatP(p.bruto)}</td>
        <td style="color:#475569">${formatP(p.tara)}</td>
        <td style="font-weight:800;font-size:12px;color:#0e7490">${formatP(p.neto)}</td>
      </tr>`).join('');

        const renderContenedorCard = (p, idx) => `
      <div class="ctn-card">
        <div class="ctn-header">
          <span>CONTENEDOR ${idx + 1} — ${p.vehiculo_patente || '—'}</span>
          <span class="ctn-badge" style="background:${p.sentido === 'SALIDA' ? '#9a3412' : '#1e40af'}">${p.sentido === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}</span>
        </div>
        <div class="ctn-body">
          <div class="ctn-section">PESADA</div>
          <div class="ctn-row"><div class="ctn-lbl">Dominio</div><div class="ctn-val ctn-mono">${p.vehiculo_patente || '—'}</div></div>
          <div class="ctn-row"><div class="ctn-lbl">Entrada Planta</div><div class="ctn-val">${formatF(p.fecha_entrada)}</div></div>
          <div class="ctn-row"><div class="ctn-lbl">Salida Planta</div><div class="ctn-val">${formatF(p.fecha_salida)}</div></div>
          <div class="ctn-row"><div class="ctn-lbl">Productor</div><div class="ctn-val">${p.productor || '—'}</div></div>
          <div class="ctn-row"><div class="ctn-lbl">Producto</div><div class="ctn-val">${p.producto || '—'}</div></div>
          <div class="ctn-row"><div class="ctn-lbl">Nro Remito</div><div class="ctn-val">${p.nro_remito || '—'}</div></div>
          <div class="ctn-row"><div class="ctn-lbl">Balancero</div><div class="ctn-val">${p.balancero || '—'}</div></div>
          <div class="ctn-row ctn-bruto"><div class="ctn-lbl">Peso Bruto</div><div class="ctn-val">${formatP(p.bruto)}</div></div>
          <div class="ctn-row ctn-tara"><div class="ctn-lbl">Peso Tara</div><div class="ctn-val">${formatP(p.tara)}</div></div>
          <div class="ctn-row ctn-neto"><div class="ctn-lbl">Peso Neto</div><div class="ctn-val">${formatP(p.neto)}</div></div>
          <div class="ctn-section">DATOS CONTENEDOR</div>
          <div class="ctn-row"><div class="ctn-lbl">Nro Contenedor</div><div class="ctn-val ctn-mono">${p.nro_contenedor || '—'}</div></div>
          ${p.tara_contenedor != null ? `<div class="ctn-row"><div class="ctn-lbl">Tara Contenedor</div><div class="ctn-val">${Number(p.tara_contenedor).toLocaleString('es-AR')} kg</div></div>` : ''}
          ${p.peso_vgm != null ? `<div class="ctn-row"><div class="ctn-lbl">Peso VGM</div><div class="ctn-val">${Number(p.peso_vgm).toLocaleString('es-AR')} kg</div></div>` : ''}
          ${p.cantidad_bultos != null ? `<div class="ctn-row"><div class="ctn-lbl">Cant. Bultos</div><div class="ctn-val">${p.cantidad_bultos}</div></div>` : ''}
          ${p.nro_proforma ? `<div class="ctn-row"><div class="ctn-lbl">Nro Proforma</div><div class="ctn-val">${p.nro_proforma}</div></div>` : ''}
          ${p.nro_permiso_embarque ? `<div class="ctn-row"><div class="ctn-lbl">Perm. Embarque</div><div class="ctn-val">${p.nro_permiso_embarque}</div></div>` : ''}
          <div class="ctn-section">ATA</div>
          <div class="ctn-row"><div class="ctn-lbl">Nombre</div><div class="ctn-val">Gabriela Celano</div></div>
          <div class="ctn-row"><div class="ctn-lbl">CUIT</div><div class="ctn-val ctn-mono">27-22432451-6</div></div>
        </div>
      </div>`;

        const renderReporte = () => `
      <div class="header">
        <div>
          <h1>Reporte de Pesadas</h1>
          <div style="font-size:9px;color:#64748b;margin-top:4px">Emisión: ${fechaEmision}</div>
        </div>
        <div class="meta">
          ${nroLabel ? `<strong>${nroLabel}</strong>` : ''}
          <div style="margin-top:4px">${pesadas.length} pesada${pesadas.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      ${normales.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>#</th><th>Sentido</th><th>Dominio</th><th>Entrada Planta</th>
            <th>Salida Planta</th><th>Productor</th><th>Producto</th><th>Remito</th>
            <th>Bruto</th><th>Tara</th><th>Neto</th>
          </tr>
        </thead>
        <tbody>${filasNormales}</tbody>
        <tfoot>
          <tr>
            <td colspan="8" style="text-align:right;font-size:9px">Totales</td>
            <td>${totalBruto.toLocaleString('es-AR')} kg</td>
            <td>${totalTara.toLocaleString('es-AR')} kg</td>
            <td style="font-size:12px">${totalNeto.toLocaleString('es-AR')} kg</td>
          </tr>
        </tfoot>
      </table>
      <div class="totales-boxes">
        <div class="total-box"><div class="t-label">Bruto</div><div class="t-valor">${totalBruto.toLocaleString('es-AR')}</div></div>
        <div class="total-box"><div class="t-label">Tara</div><div class="t-valor">${totalTara.toLocaleString('es-AR')}</div></div>
        <div class="total-box neto"><div class="t-label">Neto</div><div class="t-valor">${totalNeto.toLocaleString('es-AR')}</div></div>
      </div>` : ''}

      ${contenedores.length > 0 ? `
      <div style="margin-top:${normales.length > 0 ? '14px' : '0'}">
        ${contenedores.map((p, i) => renderContenedorCard(p, i)).join('')}
      </div>` : ''}

      <div class="firmas">
        <div class="firma-bloque"><div class="firma-linea"><p class="firma-titulo">Firma Responsable</p></div></div>
        <div class="firma-bloque"><div class="firma-linea"><p class="firma-titulo">Conformidad</p></div></div>
      </div>
    `;

        const printWindow = window.open('', '_blank', 'width=900,height=700');

        printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>Reporte de Pesadas ${nroLabel}</title>
        <style>
          * { box-sizing:border-box; margin:0; padding:0; }

          body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            color:#111;
            background:#fff;
            padding:8mm;
          }

          .header {
            display:flex;
            justify-content:space-between;
            border-bottom:2px solid #1e293b;
            margin-bottom:8px;
            padding-bottom:6px;
          }

          .header h1 {
            font-size:14px;
            font-weight:900;
          }

          .meta {
            text-align:right;
            font-size:9px;
          }

          .meta strong {
            font-size:12px;
          }

          table {
            width:100%;
            border-collapse:collapse;
            font-size:9px;
          }

          thead {
            background:#1e293b;
            color:#fff;
          }

          th, td {
            padding:4px;
            border-bottom:1px solid #ddd;
            text-align:left;
          }

          tfoot {
            background:#f1f5f9;
            font-weight:bold;
          }

          .totales-boxes {
            display:flex;
            justify-content:flex-end;
            gap:10px;
            margin-top:8px;
          }

          .total-box {
            border:1px solid #1e293b;
            padding:4px 8px;
            text-align:center;
            min-width:70px;
          }

          .t-label {
            font-size:8px;
          }

          .t-valor {
            font-size:12px;
            font-weight:bold;
          }

          .firmas {
            display:flex;
            justify-content:space-between;
            margin-top:16px;
          }

          .firma-linea {
            border-top:1px solid #000;
            width:120px;
            text-align:center;
            font-size:9px;
            margin-top:10px;
          }

          /* ── Tarjeta Contenedor ── */
          .ctn-card {
            border:2px solid #06b6d4;
            border-radius:6px;
            margin-bottom:12px;
            overflow:hidden;
            page-break-inside:avoid;
          }
          .ctn-header {
            background:#0e7490;
            color:#fff;
            padding:7px 12px;
            font-size:12px;
            font-weight:900;
            display:flex;
            justify-content:space-between;
            align-items:center;
          }
          .ctn-badge {
            color:#fff;
            padding:2px 8px;
            border-radius:4px;
            font-size:10px;
            font-weight:700;
          }
          .ctn-body {
            padding:0;
          }
          .ctn-section {
            background:#ecfeff;
            padding:4px 12px;
            font-size:9px;
            font-weight:900;
            text-transform:uppercase;
            letter-spacing:0.08em;
            color:#0e7490;
            border-top:1px solid #a5f3fc;
            border-bottom:1px solid #a5f3fc;
          }
          .ctn-row {
            display:flex;
            align-items:baseline;
            padding:5px 12px;
            border-bottom:1px solid #e0f7fa;
            font-size:11px;
          }
          .ctn-lbl {
            width:170px;
            flex-shrink:0;
            color:#0e7490;
            opacity:0.75;
            font-size:10px;
          }
          .ctn-val {
            font-weight:700;
            font-size:12px;
          }
          .ctn-mono { font-family:monospace; }
          .ctn-bruto .ctn-val { color:#15803d; }
          .ctn-tara  .ctn-val { color:#475569; }
          .ctn-neto  .ctn-val { color:#0e7490; font-size:15px; }

          /* 🔥 DUPLICADO */
          .page {
            height:48%;
          }

          .cut-line {
            position: relative;
            top: -30px;
            border-top:2px dashed #000;
            margin:6px 0;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          @media print {
            body {
              height:100vh;
              display:flex;
              flex-direction:column;
            }

            .page {
              height:50%;
            }
          }
        </style>
      </head>

      <body>

        <div class="page">
          ${renderReporte()}
        </div>

        ${esCamionero ? `
        <div class="cut-line"></div>
        <div class="page">
          ${renderReporte()}
        </div>
        ` : ''}

      </body>
      </html>
    `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className={`rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'
                }`}>

                {/* Header */}
                <div className={`sticky top-0 p-4 flex items-center justify-between rounded-t-xl border-b z-10 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold">Reporte de Pesadas</h2>
                            {/* Estado de guardado */}
                            {guardando && (
                                <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                    <Loader2 size={12} className="animate-spin" />
                                    Guardando...
                                </span>
                            )}
                            {!guardando && !errorGuardar && numeroReporte && (
                                <span className={`text-xs px-3 py-1 rounded-full font-bold ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-700'
                                    }`}>
                                    ✓ Guardado — N° {String(numeroReporte).padStart(6, '0')}
                                </span>
                            )}
                            {!guardando && errorGuardar && (
                                <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700'
                                    }`}>
                                    ✗ Error al guardar
                                </span>
                            )}
                        </div>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {pesadas.length} pesada{pesadas.length !== 1 ? 's' : ''} · {fechaEmision}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Toggle Para Camionero */}
                        <button
                            onClick={() => setParaCamionero(v => !v)}
                            title={paraCamionero ? 'Modo camionero: imprime copia doble' : 'Modo estándar: imprime una copia'}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-semibold text-sm transition-all ${
                                paraCamionero
                                    ? isDark
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                        : 'bg-amber-50 border-amber-400 text-amber-700'
                                    : isDark
                                        ? 'bg-white/5 border-white/15 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            <Truck size={15} />
                            <span>Reporte Interno</span>
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-black ${
                                !paraCamionero
                                    ?isDark ? 'border-slate-500' : 'border-slate-300'                                     
                                    : 'bg-amber-500 border-amber-500 text-white'
                            }`}>
                                {paraCamionero ? '✓' : ''}
                            </span>
                        </button>

                        <button
                            onClick={() => handlePrint(!paraCamionero)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all"
                        >
                            <Printer size={18} />
                            Imprimir{!paraCamionero ? ' (×2)' : ''}
                        </button>
                        <button onClick={onClose} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                            }`}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Preview */}
                <div className="p-4 space-y-4">

                    {/* Tabla pesadas normales */}
                    {pesadas.filter(p => !p.es_contenedor).length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className={isDark ? 'bg-slate-700' : 'bg-slate-800'}>
                                        {['#', 'Sentido', 'Dominio', 'Entrada', 'Salida', 'Productor', 'Transporte', 'Producto', 'Remito', 'Bruto', 'Tara', 'Neto', 'Balancero'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-white font-bold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pesadas.filter(p => !p.es_contenedor).map((p, i) => (
                                        <tr key={i} className={`border-b transition-colors ${isDark
                                            ? i % 2 === 0 ? 'border-slate-700' : 'bg-slate-700/30 border-slate-700'
                                            : i % 2 === 0 ? 'border-slate-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.sentido === 'SALIDA' ? isDark ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-100 text-orange-700' : isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                                    {p.sentido === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}
                                                </span>
                                            </td>
                                            <td className={`px-3 py-2.5 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.vehiculo_patente}</td>
                                            <td className={`px-3 py-2.5 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatF(p.fecha_entrada)}</td>
                                            <td className={`px-3 py-2.5 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatF(p.fecha_salida)}</td>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{p.productor || '—'}</td>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{p.transporte || '—'}</td>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{p.producto || '—'}</td>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{p.nro_remito || '—'}</td>
                                            <td className={`px-3 py-2.5 font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{formatP(p.bruto)}</td>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatP(p.tara)}</td>
                                            <td className={`px-3 py-2.5 font-bold text-sm ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>{formatP(p.neto)}</td>
                                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.balancero || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className={`border-t-2 ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                        <td colSpan={9} className={`px-3 py-3 text-right text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Totales</td>
                                        <td className={`px-3 py-3 font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{totalBruto.toLocaleString('es-AR')} kg</td>
                                        <td className={`px-3 py-3 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{totalTara.toLocaleString('es-AR')} kg</td>
                                        <td className={`px-3 py-3 font-bold text-base ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>{totalNeto.toLocaleString('es-AR')} kg</td>
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Tarjetas contenedores */}
                    {pesadas.filter(p => p.es_contenedor).map((p, i) => (
                        <div key={i} className={`rounded-2xl overflow-hidden border-2 ${isDark ? 'border-cyan-500/50' : 'border-cyan-400'}`}>
                            {/* Header tarjeta */}
                            <div className={`flex items-center justify-between px-5 py-3 ${isDark ? 'bg-cyan-900/40' : 'bg-cyan-700'}`}>
                                <span className="text-white font-black text-sm">CONTENEDOR {i + 1} — {p.vehiculo_patente || '—'}</span>
                                <span className={`px-3 py-1 rounded font-bold text-xs text-white ${p.sentido === 'SALIDA' ? 'bg-orange-600' : 'bg-blue-700'}`}>
                                    {p.sentido === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}
                                </span>
                            </div>

                            {/* Sección Pesada */}
                            <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-b ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>Pesada</div>
                            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                                {[
                                    ['Dominio', <span className="font-mono">{p.vehiculo_patente || '—'}</span>],
                                    ['Entrada Planta', formatF(p.fecha_entrada)],
                                    ['Salida Planta', formatF(p.fecha_salida)],
                                    ['Productor', p.productor || '—'],
                                    ['Producto', p.producto || '—'],
                                    ['Nro Remito', p.nro_remito || '—'],
                                    ['Balancero', p.balancero || '—'],
                                ].map(([lbl, val]) => (
                                    <div key={lbl} className={`flex items-baseline px-5 py-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                        <span className={`w-44 flex-shrink-0 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{lbl}</span>
                                        <span className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{val}</span>
                                    </div>
                                ))}
                                <div className={`flex items-baseline px-5 py-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                    <span className={`w-44 flex-shrink-0 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Peso Bruto</span>
                                    <span className={`text-base font-black ${isDark ? 'text-green-400' : 'text-green-700'}`}>{formatP(p.bruto)}</span>
                                </div>
                                <div className={`flex items-baseline px-5 py-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                    <span className={`w-44 flex-shrink-0 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Peso Tara</span>
                                    <span className={`text-base font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatP(p.tara)}</span>
                                </div>
                                <div className={`flex items-baseline px-5 py-2 ${isDark ? 'bg-cyan-500/10 hover:bg-cyan-500/15' : 'bg-cyan-50 hover:bg-cyan-100'}`}>
                                    <span className={`w-44 flex-shrink-0 text-xs font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>Peso Neto</span>
                                    <span className={`text-xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{formatP(p.neto)}</span>
                                </div>
                            </div>

                            {/* Sección Datos Contenedor */}
                            <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-y ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>Datos Contenedor</div>
                            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                                {[
                                    ['Nro Contenedor', <span className="font-mono">{p.nro_contenedor || '—'}</span>],
                                    ...(p.tara_contenedor != null ? [['Tara Contenedor', `${Number(p.tara_contenedor).toLocaleString('es-AR')} kg`]] : []),
                                    ...(p.peso_vgm != null ? [['Peso VGM', `${Number(p.peso_vgm).toLocaleString('es-AR')} kg`]] : []),
                                    ...(p.cantidad_bultos != null ? [['Cant. Bultos', String(p.cantidad_bultos)]] : []),
                                    ...(p.nro_proforma ? [['Nro Proforma', p.nro_proforma]] : []),
                                    ...(p.nro_permiso_embarque ? [['Perm. Embarque', p.nro_permiso_embarque]] : []),
                                ].map(([lbl, val]) => (
                                    <div key={lbl} className={`flex items-baseline px-5 py-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                        <span className={`w-44 flex-shrink-0 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{lbl}</span>
                                        <span className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Sección ATA */}
                            <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-y ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>ATA</div>
                            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                                {[['Nombre', 'Gabriela Celano'], ['CUIT', '27-22432451-6']].map(([lbl, val]) => (
                                    <div key={lbl} className={`flex items-baseline px-5 py-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                        <span className={`w-44 flex-shrink-0 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{lbl}</span>
                                        <span className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}