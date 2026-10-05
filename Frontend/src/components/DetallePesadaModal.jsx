import React from 'react';
import { X, FileText, Camera, Calendar, User, Truck, Package, Scale, Hash, Info } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';

export default function DetallePesadaModal({ abierto, item, onClose }) {
  const { isDark } = useThemeContext();

  if (!abierto || !item) return null;

  const formatFecha = (val) => {
    if (!val) return '-';
    return new Date(val).toLocaleString('es-AR');
  };

  const formatPeso = (val) => {
    if (val == null) return '-';
    return `${Number(val).toLocaleString('es-AR')} kg`;
  };

  // Procesar fotos: el backend devuelve todas_fotos como un array de arrays por el jsonb_agg
  const fotosRaw = item.todas_fotos || (item.fotos ? [item.fotos] : []);
  const fotos = Array.isArray(fotosRaw) ? fotosRaw.flat().filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col transition-all transform animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border border-white/10' : 'bg-white'
        }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/20">
              <Scale size={24} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Detalle de Operación #{item.operacion_id || item.id}
              </h2>
              <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {item.vehiculo_patente} — {item.sentido || '—'} — {item.abierta ? 'PENDIENTE' : 'COMPLETADA'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-90 ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

            {/* Columna Izquierda: Información General */}
            <div className="space-y-8">
              <section>
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  <Info size={14} /> Información de Carga
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <DetailItem icon={Info} label="Sentido" value={item.sentido} isDark={isDark} />
                  <DetailItem icon={Truck} label="Transporte" value={item.transporte} isDark={isDark} />
                  <DetailItem icon={User} label="Chofer" value={item.chofer} isDark={isDark} />
                  <DetailItem icon={Package} label="Producto" value={item.producto} isDark={isDark} />
                  <DetailItem icon={User} label="Productor" value={item.productor} isDark={isDark} />
                  <DetailItem icon={Hash} label="Nro Remito" value={item.nro_remito} isDark={isDark} />
                  <DetailItem icon={User} label="Balancero" value={item.balancero} isDark={isDark} />
                  {item.es_contenedor && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold w-fit ${isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border border-cyan-200'}`}>
                      <Package size={12} /> CONTENEDOR
                    </div>
                  )}
                </div>
              </section>

              {item.es_contenedor && (
                <section>
                  <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    <Package size={14} /> Datos de Contenedor
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <DetailItem icon={Hash} label="Nro Contenedor" value={item.nro_contenedor} isDark={isDark} />
                    {item.peso_vgm != null && <DetailItem icon={Scale} label="Peso VGM" value={`${Number(item.peso_vgm).toLocaleString('es-AR')} kg`} isDark={isDark} />}
                    {item.tara_contenedor != null && <DetailItem icon={Scale} label="Tara Contenedor" value={`${Number(item.tara_contenedor).toLocaleString('es-AR')} kg`} isDark={isDark} />}
                    {item.cantidad_bultos != null && <DetailItem icon={Hash} label="Cantidad Bultos" value={item.cantidad_bultos} isDark={isDark} />}
                    {item.nro_proforma && <DetailItem icon={Hash} label="Nro Proforma" value={item.nro_proforma} isDark={isDark} />}
                    {item.nro_permiso_embarque && <DetailItem icon={Hash} label="Nro Permiso Embarque" value={item.nro_permiso_embarque} isDark={isDark} />}
                  </div>
                </section>
              )}

              <section>
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <Scale size={14} /> Pesos y Tiempos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <WeightItem label="Peso Bruto" value={item.bruto} color={isDark ? 'text-green-400' : 'text-green-600'} isDark={isDark} />
                  <WeightItem label="Peso Tara" value={item.tara} color={isDark ? 'text-slate-300' : 'text-slate-600'} isDark={isDark} />
                  <div className="sm:col-span-2">
                    <WeightItem label="Peso Neto" value={item.neto} color={isDark ? 'text-cyan-400' : 'text-cyan-600'} isLarge isDark={isDark} />
                  </div>
                  <DetailItem icon={Calendar} label="Entrada" value={formatFecha(item.fecha_entrada)} isDark={isDark} />
                  <DetailItem icon={Calendar} label="Salida" value={formatFecha(item.fecha_salida)} isDark={isDark} />
                </div>
              </section>
            </div>

            {/* Columna Derecha: Multimedia */}
            <div className="space-y-8">
              {/* PDF Document */}
              <section>
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                  <FileText size={14} /> Documentación
                </h3>
                {item.ruta ? (
                  <a
                    href={item.ruta.startsWith('documentos/') ? `/${item.ruta}` : `/documentos/${item.ruta}`}
                    target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-800/50 border-white/10 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-lg'
                      }`}
                  >
                    <div className="p-3 bg-rose-500/20 text-rose-500 rounded-xl">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Carta de Porte / Remito</p>
                      <p className="text-xs text-slate-500">Documento PDF Adjunto</p>
                    </div>
                  </a>
                ) : (
                  <div className={`p-6 rounded-2xl border-2 border-dashed text-center ${isDark ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50'}`}>
                    <p className="text-sm text-slate-500 font-medium italic">No hay documento PDF asociado</p>
                  </div>
                )}
              </section>

              {/* Photos Gallery */}
              <section>
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  <Camera size={14} /> Capturas de Cámaras
                </h3>
                {fotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {fotos.map((foto, idx) => {
                      const src = typeof foto === 'string' ? foto : foto.ruta;
                      const canal = typeof foto === 'object' ? foto.canal : null;
                      return (
                        <div key={idx} className={`aspect-video rounded-2xl overflow-hidden border relative group ${isDark ? 'bg-slate-800 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                          <img
                            src={`/capturas/${src}`}
                            alt={`Captura ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            {canal ? `CÁMARA ${canal}` : `CAPTURA ${idx + 1}`}
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a href={`/capturas/${src}`} target="_blank" rel="noreferrer" className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-white font-bold text-xs hover:bg-white/40 transition-colors">
                              Ver ampliada
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`p-8 rounded-2xl border-2 border-dashed text-center ${isDark ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50'}`}>
                    <Camera size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-slate-500 font-medium italic">No se encontraron fotos vinculadas</p>
                  </div>
                )}
              </section>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t flex justify-end ${isDark ? 'border-white/10 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <button
            onClick={onClose}
            className={`px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 ${isDark
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20'
              }`}
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, isDark }) {
  return (
    <div className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/30 border-white/5 hover:bg-slate-800/50' : 'bg-white border-slate-100 hover:border-slate-200'
      }`}>
      <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
        <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          {value || <span className="opacity-30 italic font-normal">No especificado</span>}
        </p>
      </div>
    </div>
  );
}

function WeightItem({ label, value, color, isLarge = false, isDark }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50 border-slate-100'
      }`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`font-mono font-black ${isLarge ? 'text-3xl' : 'text-xl'} ${color}`}>
        {value != null ? Number(value).toLocaleString('es-AR') : '—'} <span className="text-sm opacity-50 ml-1">kg</span>
      </p>
    </div>
  );
}
