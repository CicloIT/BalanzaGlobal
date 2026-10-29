import React, { useState, useEffect, useRef } from 'react';
import { Printer, Truck, FileBarChart, CheckCircle2, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Spinner from './ui/Spinner';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

export default function ReportePesadas({ pesadas, onClose }) {
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
        />
    );
}

function FilaDato({ label, children, destacado }) {
    return (
        <div className={`flex items-baseline gap-3 px-4 py-2 ${destacado ? 'bg-brand-soft' : ''}`}>
            <span className="w-40 shrink-0 text-xs text-fg-subtle">{label}</span>
            <span className={`text-sm text-fg ${destacado ? 'font-bold' : 'font-medium'}`}>{children}</span>
        </div>
    );
}

// ─── Preview reutilizable (usado tanto en ReportePesadas como en historial) ──
export function ReportePreview({ pesadas, numeroReporte, fechaEmision, guardando, errorGuardar, onClose }) {
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

    const normalesVista = pesadas.filter(p => !p.es_contenedor);
    const contenedoresVista = pesadas.filter(p => p.es_contenedor);

    return (
        <Modal
            size="2xl"
            onClose={onClose}
            icon={FileBarChart}
            title={numeroReporte ? `Reporte de pesadas N° ${String(numeroReporte).padStart(6, '0')}` : 'Reporte de pesadas'}
            subtitle={`${pesadas.length} pesada${pesadas.length !== 1 ? 's' : ''} · ${fechaEmision}`}
            footer={(
                <>
                    <label className="mr-auto flex items-center gap-2 text-sm text-fg-muted cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={paraCamionero}
                            onChange={() => setParaCamionero(v => !v)}
                            className="h-4 w-4 accent-[var(--brand-solid)]"
                        />
                        <Truck size={15} aria-hidden="true" />
                        Reporte interno (una sola copia)
                    </label>
                    <Button onClick={onClose}>Cerrar</Button>
                    <Button variant="primary" icon={Printer} onClick={() => handlePrint(!paraCamionero)}>
                        {paraCamionero ? 'Imprimir' : 'Imprimir 2 copias'}
                    </Button>
                </>
            )}
        >
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {guardando && <Badge tone="info" icon={Spinner}>Guardando reporte...</Badge>}
                {!guardando && !errorGuardar && numeroReporte && (
                    <Badge tone="success" icon={CheckCircle2}>Guardado en el historial</Badge>
                )}
                {!guardando && errorGuardar && (
                    <Badge tone="danger" icon={AlertCircle}>No se pudo guardar: {errorGuardar}</Badge>
                )}
                {!paraCamionero && (
                    <span className="text-xs text-fg-subtle">Se imprimen dos copias en una hoja A4 con línea de corte (una para el camionero).</span>
                )}
            </div>

            {/* Tabla pesadas normales */}
            {normalesVista.length > 0 && (
                <div className="relative overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-xs">
                        <thead className="bg-surface-2">
                            <tr className="border-b border-line">
                                {['#', 'Sentido', 'Dominio', 'Entrada', 'Salida', 'Productor', 'Transporte', 'Producto', 'Remito', 'Bruto', 'Tara', 'Neto', 'Balancero'].map(h => (
                                    <th key={h} scope="col" className={`px-3 py-2.5 font-semibold uppercase tracking-wide text-[11px] text-fg-subtle whitespace-nowrap ${['Bruto', 'Tara', 'Neto'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {normalesVista.map((p, i) => (
                                <tr key={i} className="border-b border-line last:border-b-0">
                                    <td className="px-3 py-2 text-fg-subtle tabular">{i + 1}</td>
                                    <td className="px-3 py-2">
                                        <Badge size="sm" tone={p.sentido === 'SALIDA' ? 'salida' : 'ingreso'}>{p.sentido === 'SALIDA' ? '↑ Salida' : '↓ Ingreso'}</Badge>
                                    </td>
                                    <td className="px-3 py-2 font-mono font-semibold text-fg">{p.vehiculo_patente}</td>
                                    <td className="px-3 py-2 text-fg-muted tabular whitespace-nowrap">{formatF(p.fecha_entrada)}</td>
                                    <td className="px-3 py-2 text-fg-muted tabular whitespace-nowrap">{formatF(p.fecha_salida)}</td>
                                    <td className="px-3 py-2 text-fg">{p.productor || '—'}</td>
                                    <td className="px-3 py-2 text-fg">{p.transporte || '—'}</td>
                                    <td className="px-3 py-2 text-fg">{p.producto || '—'}</td>
                                    <td className="px-3 py-2 text-fg-muted">{p.nro_remito || '—'}</td>
                                    <td className="px-3 py-2 text-right tabular text-fg whitespace-nowrap">{formatP(p.bruto)}</td>
                                    <td className="px-3 py-2 text-right tabular text-fg-muted whitespace-nowrap">{formatP(p.tara)}</td>
                                    <td className="px-3 py-2 text-right tabular font-semibold text-fg whitespace-nowrap">{formatP(p.neto)}</td>
                                    <td className="px-3 py-2 text-fg-muted">{p.balancero || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-surface-2">
                            <tr className="border-t border-line-strong">
                                <td colSpan={9} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-subtle">Totales</td>
                                <td className="px-3 py-2.5 text-right tabular font-semibold text-fg whitespace-nowrap">{totalBruto.toLocaleString('es-AR')} kg</td>
                                <td className="px-3 py-2.5 text-right tabular font-semibold text-fg whitespace-nowrap">{totalTara.toLocaleString('es-AR')} kg</td>
                                <td className="px-3 py-2.5 text-right tabular text-sm font-bold text-fg whitespace-nowrap">{totalNeto.toLocaleString('es-AR')} kg</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Tarjetas contenedores */}
            <div className="space-y-4 mt-4">
                {contenedoresVista.map((p, i) => (
                    <div key={i} className="overflow-hidden rounded-lg border border-line">
                        <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5 border-b border-line">
                            <span className="text-sm font-semibold text-fg">Contenedor {i + 1} — <span className="font-mono">{p.vehiculo_patente || '—'}</span></span>
                            <Badge tone={p.sentido === 'SALIDA' ? 'salida' : 'ingreso'}>{p.sentido === 'SALIDA' ? '↑ Salida' : '↓ Ingreso'}</Badge>
                        </div>
                        <div className="grid md:grid-cols-2 md:divide-x divide-line">
                            <div className="divide-y divide-line">
                                <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle bg-surface-2">Pesada</p>
                                <FilaDato label="Dominio"><span className="font-mono">{p.vehiculo_patente || '—'}</span></FilaDato>
                                <FilaDato label="Entrada planta">{formatF(p.fecha_entrada)}</FilaDato>
                                <FilaDato label="Salida planta">{formatF(p.fecha_salida)}</FilaDato>
                                <FilaDato label="Productor">{p.productor || '—'}</FilaDato>
                                <FilaDato label="Producto">{p.producto || '—'}</FilaDato>
                                <FilaDato label="Nro. remito">{p.nro_remito || '—'}</FilaDato>
                                <FilaDato label="Balancero">{p.balancero || '—'}</FilaDato>
                                <FilaDato label="Peso bruto">{formatP(p.bruto)}</FilaDato>
                                <FilaDato label="Peso tara">{formatP(p.tara)}</FilaDato>
                                <FilaDato label="Peso neto" destacado>{formatP(p.neto)}</FilaDato>
                            </div>
                            <div className="divide-y divide-line">
                                <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle bg-surface-2">Datos contenedor</p>
                                <FilaDato label="Nro. contenedor"><span className="font-mono">{p.nro_contenedor || '—'}</span></FilaDato>
                                {p.tara_contenedor != null && <FilaDato label="Tara contenedor">{`${Number(p.tara_contenedor).toLocaleString('es-AR')} kg`}</FilaDato>}
                                {p.peso_vgm != null && <FilaDato label="Peso VGM">{`${Number(p.peso_vgm).toLocaleString('es-AR')} kg`}</FilaDato>}
                                {p.cantidad_bultos != null && <FilaDato label="Cant. bultos">{String(p.cantidad_bultos)}</FilaDato>}
                                {p.nro_proforma && <FilaDato label="Nro. proforma">{p.nro_proforma}</FilaDato>}
                                {p.nro_permiso_embarque && <FilaDato label="Perm. embarque">{p.nro_permiso_embarque}</FilaDato>}
                                <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle bg-surface-2">ATA</p>
                                <FilaDato label="Nombre">Gabriela Celano</FilaDato>
                                <FilaDato label="CUIT"><span className="font-mono">27-22432451-6</span></FilaDato>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
