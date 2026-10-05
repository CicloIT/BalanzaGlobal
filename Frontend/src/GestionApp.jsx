import React, { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Header from './components/Header';
import ActionBar from './components/ActionBar';
import TablaItems from './components/TablaItems';
import ModalForm from './components/ModalForm';
import EmptyState from './components/EmptyState';
import PesadaForm from './components/PesadaForm';
import { useGestionAPI } from './hooks/useGestionAPI';
import { usePesadasInfinite } from './hooks/usePesadasInfinite';
import { useVehiculosInfinite } from './hooks/useVehiculosInfinite';
import { useThemeContext } from './context/ThemeContext';
import { usePermissions } from './hooks/usePermissions';
import { choferesConfig } from './config/choferesConfig';
import { productoresConfig } from './config/productoresConfig';
import { productosConfig } from './config/productosConfig';
import { transportesConfig } from './config/transportesConfig';
import { provinciasConfig } from './config/provinciasConfig';
import { localidadesConfig } from './config/localidadesConfig';
import { vehiculosConfig } from './config/vehiculosConfig';
import { pesadasConfig } from './config/pesadasConfig';
import Dashboard from './components/Dashboard';
import ReportePesadas from './components/ReportePesadas';
import ReportesHistorial from './components/ReportesHistorial';
import Guard from './components/Guard';
import ProtectedRoute from './components/ProtectedRoute';
import DetallePesadaModal from './components/DetallePesadaModal';
import ContenedorModal from './components/ContenedorModal';
import Configuracion from './components/Configuracion';

export default function GestionApp() {
  const { isDark } = useThemeContext();
  const { hasModuleAccess, canEditModule, isAdmin, PERMISSIONS, MODULES } = usePermissions();

  const configs = {
    choferes: choferesConfig,
    productores: productoresConfig,
    productos: productosConfig,
    transportes: transportesConfig,
    provincias: provinciasConfig,
    localidades: localidadesConfig,
    vehiculos: vehiculosConfig,
    pesadas: pesadasConfig,
  };

  // Determinar el tab inicial según los permisos del usuario
  const getInitialTab = () => {
    if (hasModuleAccess(MODULES.DASHBOARD)) return MODULES.DASHBOARD;
    if (hasModuleAccess(MODULES.PESADA)) return MODULES.PESADA;
    if (hasModuleAccess(MODULES.PESADAS)) return MODULES.PESADAS;
    // Buscar el primer módulo disponible
    const availableModules = [
      MODULES.CHOFERES,
      MODULES.PRODUCTORES,
      MODULES.PRODUCTOS,
      MODULES.TRANSPORTES,
      MODULES.VEHICULOS,
      MODULES.PROVINCIAS,
      MODULES.LOCALIDADES
    ];
    for (const module of availableModules) {
      if (hasModuleAccess(module)) return module;
    }
    return MODULES.DASHBOARD;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const choferes = useGestionAPI(choferesConfig, hasModuleAccess(MODULES.CHOFERES));
  const productores = useGestionAPI(productoresConfig, hasModuleAccess(MODULES.PRODUCTORES));
  const productos = useGestionAPI(productosConfig, hasModuleAccess(MODULES.PRODUCTOS));
  const transportes = useGestionAPI(transportesConfig, hasModuleAccess(MODULES.TRANSPORTES));
  const provincias = useGestionAPI(provinciasConfig, canEditModule(MODULES.PROVINCIAS));
  const localidades = useGestionAPI(localidadesConfig, canEditModule(MODULES.LOCALIDADES));
  const [searchTerm, setSearchTerm] = useState('');
  const vehiculos = useVehiculosInfinite(vehiculosConfig, hasModuleAccess(MODULES.VEHICULOS) && activeTab === MODULES.VEHICULOS, activeTab === MODULES.VEHICULOS ? searchTerm : '');

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sentidoFiltro, setSentidoFiltro] = useState(null);
  const [fechaFiltro, setFechaFiltro] = useState(null);
  const [mesFiltro, setMesFiltro] = useState(null);
  const [anioFiltro, setAnioFiltro] = useState(null);

  const pesadas = usePesadasInfinite(activeTab === MODULES.PESADAS, refreshTrigger, sentidoFiltro, fechaFiltro, mesFiltro, anioFiltro);

  const anioActual = new Date().getFullYear();
  const aniosDisponibles = Array.from({ length: anioActual - 2019 }, (_, i) => anioActual - i);
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const [pesadaDetalle, setPesadaDetalle] = useState(null);
  const [pesadasReporte, setPesadasReporte] = useState(null);
  const [contenedorModal, setContenedorModal] = useState(null);

  useEffect(() => { setSearchTerm(''); }, [activeTab]);

  const handleEliminarIndividual = async (id) => {
  try {
    const confirmacion = window.confirm('¿Eliminar este registro?');
    if (!confirmacion) return;

    const storedUser = JSON.parse(localStorage.getItem('balanza_user') || '{}');
    const headers = {
      ...(storedUser.id && { 'x-user-id': storedUser.id.toString() }),
      ...(storedUser.username && { 'x-username': storedUser.username }),
    };

    const endpoint = activeTab === 'pesadas'
      ? `/api/pesadas/operacion/${id}`
      : `${currentConfig.endpoint}/${id}`;

    const response = await fetch(endpoint, { method: 'DELETE', headers });
    if (!response.ok) throw new Error('Error eliminando');

    if (activeTab === 'pesadas') {
      setRefreshTrigger(Date.now());
    } else {
      currentGestion.fetchItems?.();
    }

  } catch (err) {
    console.error(err);
    alert('Error eliminando registro');
  }
};

  const handleEliminarMultiples = async (ids) => {
    try {
      const confirmacion = window.confirm(`¿Eliminar ${ids.length} operaciones de pesaje?`);
      if (!confirmacion) return;

      const storedUser = JSON.parse(localStorage.getItem('balanza_user') || '{}');

      const response = await fetch('/api/pesadas/operaciones/delete-masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedUser.id && { 'x-user-id': storedUser.id.toString() }),
          ...(storedUser.username && { 'x-username': storedUser.username }),
        },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Error eliminando');

      // 🔥 refrescar lista SIN recargar toda la página
      setRefreshTrigger(Date.now());

    } catch (err) {
      console.error(err);
      alert('Error eliminando operaciones');
    }
  };

  const handleSubirPDF = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm(`¿Subir Carta de Porte para la operación de pesaje?`)) {
      e.target.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('archivo', file);

      const storedUser = JSON.parse(localStorage.getItem('balanza_user') || '{}');
      const headers = {};
      if (storedUser.id) headers['x-user-id'] = storedUser.id.toString();
      if (storedUser.username) headers['x-username'] = storedUser.username;

      const url = `/api/pesadas/operacion/${id}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) throw new Error('Error al subir el archivo');

      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error subiendo el PDF');
    }
  };

  const gestionMap = {
    choferes, productores, productos, transportes,
    provincias, localidades, vehiculos, pesadas,
  };

  const currentGestion = gestionMap[activeTab];
  const currentConfig = configs[activeTab];

  const SEARCHABLE_TABS = [MODULES.CHOFERES, MODULES.PRODUCTORES, MODULES.PRODUCTOS, MODULES.TRANSPORTES, MODULES.VEHICULOS];
  const CLIENT_FILTER_TABS = [MODULES.CHOFERES, MODULES.PRODUCTORES, MODULES.PRODUCTOS, MODULES.TRANSPORTES, MODULES.VEHICULOS];

  const filteredItems = useMemo(() => {
    const items = currentGestion?.items || [];
    if (!searchTerm || !CLIENT_FILTER_TABS.includes(activeTab)) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      currentConfig?.columnasKeys?.some(key =>
        String(item[key] ?? '').toLowerCase().includes(term)
      )
    );
  }, [currentGestion?.items, searchTerm, currentConfig?.columnasKeys, activeTab]);

  // Tabs filtrados según permisos del usuario
  const tabs = useMemo(() => {
    const allTabs = [
      { id: MODULES.DASHBOARD, label: 'Dashboard', count: null },
      { id: MODULES.CHOFERES, label: choferesConfig.label, count: choferes.items.length },
      { id: MODULES.PRODUCTORES, label: productoresConfig.label, count: productores.items.length },
      { id: MODULES.PRODUCTOS, label: productosConfig.label, count: productos.items.length },
      { id: MODULES.TRANSPORTES, label: transportesConfig.label, count: transportes.items.length },
      { id: MODULES.PROVINCIAS, label: provinciasConfig.label, count: provincias.items.length },
      { id: MODULES.LOCALIDADES, label: localidadesConfig.label, count: localidades.items.length },
      { id: MODULES.VEHICULOS, label: vehiculosConfig.label, count: vehiculos.items.length },
      { id: MODULES.PESADA, label: 'Nueva Pesada', count: null },
      { id: MODULES.PESADAS, label: pesadasConfig.label, count: pesadas.items.length },
      { id: MODULES.REPORTES, label: 'Reportes', count: null },
      { id: MODULES.CONFIGURACION, label: 'Configuración', count: null },
    ];

    return allTabs.filter(tab => {
      // Mostrar módulos especiales si hay acceso: Dashboard, Nueva Pesada, Pesadas, Reportes, Configuración
      if ([MODULES.DASHBOARD, MODULES.PESADA, MODULES.PESADAS, MODULES.REPORTES, MODULES.CONFIGURACION].includes(tab.id)) {
        return hasModuleAccess(tab.id);
      }

      // Para los demás (Maestros), solo mostrar si tiene permiso de escritura/edición
      // así cumplimos con "solo ver lo que puedo hacer"
      return canEditModule(tab.id);
    });
  }, [
    choferes.items.length,
    productores.items.length,
    productos.items.length,
    transportes.items.length,
    provincias.items.length,
    localidades.items.length,
    vehiculos.items.length,
    pesadas.items.length,
    hasModuleAccess,
    MODULES
  ]);

  // Verificar si el usuario puede editar el módulo actual
  const canEditCurrentModule = canEditModule(activeTab);

  // Tabs que no usan el layout genérico de tabla
  const tabsEspeciales = [MODULES.PESADA, MODULES.DASHBOARD, MODULES.REPORTES, MODULES.CONFIGURACION];

  const AlertBox = ({ type, message }) => {
    if (!message) return null;
    const bgColor = type === 'success'
      ? isDark ? 'bg-green-500/30 border-green-500/50 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
      : isDark ? 'bg-red-500/30 border-red-500/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800';
    return (
      <div className={`border rounded-lg p-4 mb-4 animate-fadeIn ${bgColor}`}>
        {message}
      </div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark
      ? 'bg-linear-to-br from-slate-900 via-slate-800 to-slate-900'
      : 'bg-linear-to-br from-blue-50 via-white to-cyan-50'
      }`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {isDark ? (
          <>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </>
        ) : (
          <>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-200/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </>
        )}
      </div>

      <div className="relative z-50">
        <Header activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {!tabsEspeciales.includes(activeTab) && (
          <>
            <AlertBox type="error" message={currentGestion?.error} />
            <AlertBox type="success" message={currentGestion?.success} />
          </>
        )}

        {/* Tabs especiales */}
        {activeTab === MODULES.PESADA && (
          <ProtectedRoute permissions={PERMISSIONS.PESAJE_CREATE}>
            <PesadaForm
              transportes={transportes.items}
              choferes={choferes.items}
              productos={productos.items}
              productores={productores.items}
              onPesadaCreated={() => setRefreshTrigger(Date.now())}
            />
          </ProtectedRoute>
        )}

        {activeTab === MODULES.DASHBOARD && (
          <ProtectedRoute permissions={PERMISSIONS.DASHBOARD_VIEW}>
            <Dashboard />
          </ProtectedRoute>
        )}

        {activeTab === MODULES.REPORTES && (
          <ProtectedRoute permissions={PERMISSIONS.REPORTES_VIEW}>
            <ReportesHistorial />
          </ProtectedRoute>
        )}

        {activeTab === MODULES.CONFIGURACION && (
          <ProtectedRoute permissions={PERMISSIONS.BACKUP_MANAGE}>
            <Configuracion />
          </ProtectedRoute>
        )}

        {/* Tabs con tabla genérica */}
        {!tabsEspeciales.includes(activeTab) && currentConfig && (
          <ProtectedRoute permissions={`${activeTab === 'pesadas' ? 'pesaje' : activeTab}:view`}>
            <div className={`backdrop-blur-xl transition-colors duration-300 rounded-2xl shadow-2xl overflow-hidden ${isDark
              ? 'bg-white/10 border border-white/20'
              : 'bg-white/70 border border-slate-200'
              }`}>
              <div className="h-1 bg-linear-to-r from-blue-500 via-cyan-500 to-blue-500"></div>

              <ActionBar
                titulo={currentConfig.plural}
                count={currentGestion.items.length}
                onAgregar={() => currentGestion.abrirModal()}
                loading={currentGestion.loading}
                permission={`${activeTab === 'pesadas' ? 'pesaje' : activeTab}:create`}
                soloLectura={activeTab === 'pesadas'}
              />

              {SEARCHABLE_TABS.includes(activeTab) && (
                <div className={`px-4 py-3 border-b flex items-center gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
                    <Search size={16} className="opacity-40 flex-shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder={`Buscar ${currentConfig?.plural?.toLowerCase() ?? ''}...`}
                      className="bg-transparent border-none outline-none w-full text-sm"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="flex-shrink-0 opacity-50 hover:opacity-100">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {activeTab === MODULES.VEHICULOS && currentGestion.hasMore && (
                    <button
                      onClick={() => currentGestion.loadAll?.()}
                      disabled={currentGestion.loading}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${isDark ? 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}
                    >
                      ↓ Cargar todos
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'pesadas' && (
                <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  {/* Sentido */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sentido:</span>
                    {[
                      { value: null, label: 'Todos' },
                      { value: 'INGRESO', label: '↓ Ingreso' },
                      { value: 'SALIDA', label: '↑ Salida' },
                    ].map(f => (
                      <button key={f.value ?? 'ts'} onClick={() => setSentidoFiltro(f.value)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${sentidoFiltro === f.value
                          ? f.value === 'SALIDA' ? 'bg-orange-500 text-white' : f.value === 'INGRESO' ? 'bg-blue-600 text-white' : isDark ? 'bg-white/20 text-white' : 'bg-slate-700 text-white'
                          : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}>{f.label}</button>
                    ))}
                  </div>

                  <div className={`w-px h-5 ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

                  {/* Fecha rápida */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fecha:</span>
                    {[
                      { value: null, label: 'Todas' },
                      { value: 'hoy', label: 'Hoy' },
                      { value: 'mes', label: 'Este mes' },
                      { value: 'anio', label: 'Este año' },
                    ].map(f => (
                      <button key={f.value ?? 'tf'} onClick={() => { setFechaFiltro(f.value); setMesFiltro(null); setAnioFiltro(null); }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${fechaFiltro === f.value && !anioFiltro
                          ? 'bg-emerald-600 text-white'
                          : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}>{f.label}</button>
                    ))}
                  </div>

                  <div className={`w-px h-5 ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

                  {/* Mes + Año específico */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Específico:</span>
                    <select
                      value={mesFiltro ?? ''}
                      onChange={e => { setMesFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'} ${anioFiltro || mesFiltro ? isDark ? 'border-emerald-500' : 'border-emerald-500' : ''}`}
                    >
                      <option value="">Mes</option>
                      {mesesNombres.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                      value={anioFiltro ?? ''}
                      onChange={e => { setAnioFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'} ${anioFiltro ? isDark ? 'border-emerald-500' : 'border-emerald-500' : ''}`}
                    >
                      <option value="">Año</option>
                      {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {(mesFiltro || anioFiltro) && (
                      <button onClick={() => { setMesFiltro(null); setAnioFiltro(null); }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>✕</button>
                    )}
                  </div>
                </div>
              )}

              {currentGestion.loading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: isDark ? '#06b6d4' : '#0ea5e9' }}></div>
                </div>
              ) : filteredItems.length > 0 || (searchTerm && currentGestion.items.length > 0) ? (
                <div className="overflow-hidden">
                  {searchTerm && filteredItems.length === 0 ? (
                    <EmptyState mensaje={`Sin resultados para "${searchTerm}"`} icono="🔍" />
                  ) : (
                  <TablaItems
                    items={filteredItems}
                    tipo={activeTab}
                    columnasKeys={currentConfig.columnasKeys}
                    columnasLabels={currentConfig.columnasLabels}
                    onEditar={currentGestion.abrirModal}
                    onEliminar={handleEliminarIndividual}
                    onToggleEstado={currentGestion.toggleEstado}
                    onSubirPDF={handleSubirPDF}
                    onEliminarMultiples={handleEliminarMultiples}
                    onGenerarReporte={setPesadasReporte}
                    onVerDetalles={setPesadaDetalle}
                    onContenedor={setContenedorModal}
                    soloLectura={activeTab === 'pesadas'}
                    hasMore={currentGestion.hasMore}
                    loadMore={currentGestion.loadMore}
                    loadingMore={currentGestion.loadingMore}
                  />
                  )}
                </div>
              ) : (
                <EmptyState
                  mensaje={`No hay ${currentConfig.plural} registrados`}
                  icono="📭"
                />
              )}
            </div>
          </ProtectedRoute>
        )}
      </div>

      {/* Modal formulario */}
      {!tabsEspeciales.includes(activeTab) && activeTab !== 'pesadas' && currentGestion && (
        <ModalForm
          abierto={currentGestion.modal.abierto}
          titulo={
            currentGestion.modal.item
              ? `Editar ${currentConfig.singular}`
              : `Nuevo ${currentConfig.singular}`
          }
          formData={currentGestion.formData}
          onFormChange={currentGestion.handleFormChange}
          onGuardar={currentGestion.guardarItem}
          onCancelar={currentGestion.cerrarModal}
          campos={currentConfig.campos}
          loading={currentGestion.loading}
          error={currentGestion.error}
        />
      )}

      {/* Reporte de múltiples pesadas — se guarda automáticamente */}
      {pesadasReporte && (
        <ReportePesadas
          pesadas={pesadasReporte}
          onClose={() => setPesadasReporte(null)}
        />
      )}

      {/* Detalle de pesada individual */}
      {pesadaDetalle && (
        <DetallePesadaModal
          abierto={!!pesadaDetalle}
          item={pesadaDetalle}
          onClose={() => setPesadaDetalle(null)}
        />
      )}

      {/* Modal datos de contenedor */}
      {contenedorModal && (
        <ContenedorModal
          abierto={!!contenedorModal}
          item={contenedorModal}
          onClose={() => setContenedorModal(null)}
          onSaved={() => setRefreshTrigger(Date.now())}
        />
      )}

      <footer className={`relative z-10 mt-8 pb-6 text-center text-xs space-y-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        <p className="font-semibold">© 2026 CicloIT — Todos los derechos reservados</p>
        <p>Diseñado y desarrollado por CicloIT</p>
        <p className="font-mono">v1.0.1</p>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}