import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { Search, X, Plus, Inbox, SearchX, ChevronsDown } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import TablaItems from './components/TablaItems';
import ModalForm from './components/ModalForm';
import PesadaForm from './components/PesadaForm';
import { useGestionAPI } from './hooks/useGestionAPI';
import { usePesadasInfinite } from './hooks/usePesadasInfinite';
import { useVehiculosInfinite } from './hooks/useVehiculosInfinite';
import { usePermissions } from './hooks/usePermissions';
import { choferesConfig } from './config/choferesConfig';
import { productoresConfig } from './config/productoresConfig';
import { productosConfig } from './config/productosConfig';
import { transportesConfig } from './config/transportesConfig';
import { provinciasConfig } from './config/provinciasConfig';
import { localidadesConfig } from './config/localidadesConfig';
import { vehiculosConfig } from './config/vehiculosConfig';
import { pesadasConfig } from './config/pesadasConfig';
import { empresasConfig } from './config/empresasConfig';
import { NAV_ITEMS } from './config/navigation';
import { useAuth } from './context/AuthContext';
import { useToast, useConfirm } from './context/feedback';
import ReportePesadas from './components/ReportePesadas';
import ReportesHistorial from './components/ReportesHistorial';
import ProtectedRoute from './components/ProtectedRoute';
import DetallePesadaModal from './components/DetallePesadaModal';
import ContenedorModal from './components/ContenedorModal';
import Configuracion from './components/Configuracion';
import UsuariosAdmin from './components/UsuariosAdmin';
import Guard from './components/Guard';
import PageHeader from './components/ui/PageHeader';
import Button from './components/ui/Button';
import Alert from './components/ui/Alert';
import Badge from './components/ui/Badge';
import EmptyState from './components/ui/EmptyState';
import Segmented from './components/ui/Segmented';
import { Card } from './components/ui/Card';
import { LoadingState } from './components/ui/Spinner';
import { controlClass } from './components/ui/controlClass';
import { cx } from './lib/cx';
import { API_BASE_URL, getAuthHeaders } from './lib/api';

// El Dashboard trae recharts: se descarga solo si el usuario lo abre
const Dashboard = lazy(() => import('./components/Dashboard'));

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function GestionApp() {
  const { hasModuleAccess, canEditModule, hasPermission, PERMISSIONS, MODULES } = usePermissions();
  const { isGlobal, isSuperadmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const configs = {
    choferes: choferesConfig,
    productores: productoresConfig,
    productos: productosConfig,
    transportes: transportesConfig,
    provincias: provinciasConfig,
    localidades: localidadesConfig,
    vehiculos: vehiculosConfig,
    pesadas: pesadasConfig,
    empresas: empresasConfig,
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
  // Usuarios globales necesitan las localidades para elegir dónde crear cada catálogo
  const localidades = useGestionAPI(localidadesConfig, canEditModule(MODULES.LOCALIDADES) || isGlobal);
  const empresas = useGestionAPI(empresasConfig, isSuperadmin);
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

  const [pesadaDetalle, setPesadaDetalle] = useState(null);
  const [pesadasReporte, setPesadasReporte] = useState(null);
  const [contenedorModal, setContenedorModal] = useState(null);

  useEffect(() => { setSearchTerm(''); }, [activeTab]);

  const handleEliminarIndividual = async (id) => {
    const ok = await confirm({
      title: 'Eliminar registro',
      message: activeTab === 'pesadas'
        ? 'Se elimina la operación de pesaje y sus pesadas. Esta acción no se puede deshacer.'
        : `Se elimina este ${currentConfig.singular}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const endpoint = activeTab === 'pesadas'
        ? `/api/pesadas/operacion/${id}`
        : `${currentConfig.endpoint}/${id}`;

      const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers: getAuthHeaders(null) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo eliminar el registro');
      }

      if (activeTab === 'pesadas') {
        setRefreshTrigger(Date.now());
      } else {
        currentGestion.fetchItems?.();
      }
      toast.success('Registro eliminado');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleEliminarMultiples = async (ids) => {
    const ok = await confirm({
      title: 'Eliminar operaciones',
      message: `Se eliminan ${ids.length} operaciones de pesaje. Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar ${ids.length}`,
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/api/pesadas/operaciones/delete-masivo`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Error eliminando');

      // Refrescar la lista sin recargar la página
      setRefreshTrigger(Date.now());
      toast.success(`${ids.length} operaciones eliminadas`);
      return true;
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron eliminar las operaciones');
      return false;
    }
  };

  const handleSubirPDF = async (e, id) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    const ok = await confirm({
      title: 'Subir carta de porte',
      message: `Se adjunta "${file.name}" a la operación de pesaje.`,
      confirmLabel: 'Subir PDF',
    });
    if (!ok) {
      input.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('archivo', file);

      const response = await fetch(`${API_BASE_URL}/api/pesadas/operacion/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(null),
        body: formData
      });

      if (!response.ok) throw new Error('Error al subir el archivo');

      setRefreshTrigger(Date.now());
      toast.success('Carta de porte adjuntada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir el PDF');
    } finally {
      input.value = '';
    }
  };

  const gestionMap = {
    choferes, productores, productos, transportes,
    provincias, localidades, vehiculos, pesadas, empresas,
  };

  const currentGestion = gestionMap[activeTab];
  const currentConfig = configs[activeTab];

  // Catálogos por localidad: un usuario global ve la columna y elige la localidad al crear
  const TABS_POR_LOCALIDAD = [MODULES.CHOFERES, MODULES.PRODUCTORES, MODULES.PRODUCTOS, MODULES.TRANSPORTES, MODULES.VEHICULOS];
  const muestraLocalidad = isGlobal && TABS_POR_LOCALIDAD.includes(activeTab);
  const columnasKeys = muestraLocalidad ? [...currentConfig.columnasKeys, 'localidad_nombre'] : currentConfig?.columnasKeys;
  const columnasLabels = muestraLocalidad ? [...currentConfig.columnasLabels, 'Localidad'] : currentConfig?.columnasLabels;
  const opcionesLocalidad = localidades.items.map(l => ({ value: l.id, label: l.nombre }));
  const camposFormulario = (() => {
    if (!currentConfig?.campos) return currentConfig?.campos;
    if (muestraLocalidad && !currentGestion?.modal?.item) {
      return [...currentConfig.campos, { name: 'localidad_id', label: 'Localidad', type: 'select', options: opcionesLocalidad }];
    }
    if (activeTab === MODULES.LOCALIDADES && isSuperadmin && !currentGestion?.modal?.item) {
      const opcionesEmpresa = empresas.items.map(e => ({ value: e.id, label: e.nombre }));
      return [...currentConfig.campos, { name: 'empresa_id', label: 'Empresa', type: 'select', options: opcionesEmpresa }];
    }
    return currentConfig.campos;
  })();

  const SEARCHABLE_TABS = [MODULES.CHOFERES, MODULES.PRODUCTORES, MODULES.PRODUCTOS, MODULES.TRANSPORTES, MODULES.VEHICULOS];
  const CLIENT_FILTER_TABS = SEARCHABLE_TABS;

  const filteredItems = useMemo(() => {
    const items = currentGestion?.items || [];
    if (!searchTerm || !CLIENT_FILTER_TABS.includes(activeTab)) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      currentConfig?.columnasKeys?.some(key =>
        String(item[key] ?? '').toLowerCase().includes(term)
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGestion?.items, searchTerm, currentConfig?.columnasKeys, activeTab]);

  // Secciones visibles según permisos: los módulos especiales por acceso, los maestros solo
  // si el usuario puede editarlos (el balancero crea catálogos desde la pesada, sin pantalla propia)
  const visibles = useMemo(() => {
    const especiales = [MODULES.DASHBOARD, MODULES.PESADA, MODULES.PESADAS, MODULES.REPORTES, MODULES.CONFIGURACION, MODULES.USUARIOS];
    const maestros = [MODULES.CHOFERES, MODULES.PRODUCTORES, MODULES.PRODUCTOS, MODULES.TRANSPORTES,
      MODULES.PROVINCIAS, MODULES.LOCALIDADES, MODULES.EMPRESAS, MODULES.VEHICULOS];
    return new Set([
      ...especiales.filter(id => hasModuleAccess(id)),
      ...maestros.filter(id => hasPermission(`${id}:update`)),
    ]);
  }, [hasModuleAccess, hasPermission, MODULES]);

  // Tabs que no usan el layout genérico de tabla
  const tabsEspeciales = [MODULES.PESADA, MODULES.DASHBOARD, MODULES.REPORTES, MODULES.CONFIGURACION, MODULES.USUARIOS];
  const esLista = !tabsEspeciales.includes(activeTab) && currentConfig;
  const esPesadas = activeTab === 'pesadas';
  const nav = NAV_ITEMS[activeTab];
  const recurso = esPesadas ? 'pesaje' : activeTab;

  // Pesadas y vehículos se cargan por páginas: el total real viene del backend
  const totalRegistros = (esPesadas || activeTab === MODULES.VEHICULOS) && currentGestion?.total
    ? currentGestion.total
    : currentGestion?.items.length ?? 0;
  const filtrosFechaActivos = Boolean(fechaFiltro || mesFiltro || anioFiltro || sentidoFiltro);

  return (
    <AppShell visibles={visibles} activo={activeTab} onSelect={setActiveTab}>
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
          <Suspense fallback={<LoadingState texto="Cargando dashboard..." />}>
            <Dashboard />
          </Suspense>
        </ProtectedRoute>
      )}

      {activeTab === MODULES.REPORTES && (
        <ProtectedRoute permissions={PERMISSIONS.REPORTES_VIEW}>
          <ReportesHistorial />
        </ProtectedRoute>
      )}

      {activeTab === MODULES.USUARIOS && (
        <ProtectedRoute permissions={PERMISSIONS.USUARIOS_VIEW}>
          <UsuariosAdmin />
        </ProtectedRoute>
      )}

      {activeTab === MODULES.CONFIGURACION && (
        <ProtectedRoute permissions={[PERMISSIONS.BACKUP_MANAGE, PERMISSIONS.DISPOSITIVOS_MANAGE]}>
          <Configuracion />
        </ProtectedRoute>
      )}

      {/* Listados con tabla genérica */}
      {esLista && (
        <ProtectedRoute permissions={`${recurso}:view`}>
          <PageHeader
            title={nav?.label ?? currentConfig.plural}
            description={nav?.description}
            meta={!currentGestion.loading && (
              <Badge tone="neutral">
                {totalRegistros.toLocaleString('es-AR')} {totalRegistros === 1 ? currentConfig.singular : currentConfig.plural}
                {esPesadas && filtrosFechaActivos ? ' con los filtros' : ''}
              </Badge>
            )}
            actions={!esPesadas && (
              <Guard permissions={`${recurso}:create`}>
                <Button variant="primary" icon={Plus} onClick={() => currentGestion.abrirModal()} disabled={currentGestion.loading}>
                  Agregar {currentConfig.singular}
                </Button>
              </Guard>
            )}
          />

          {currentGestion?.error && <Alert tone="danger" className="mb-4">{currentGestion.error}</Alert>}
          {currentGestion?.success && <Alert tone="success" className="mb-4">{currentGestion.success}</Alert>}

          <Card className="overflow-hidden">
            {SEARCHABLE_TABS.includes(activeTab) && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={`Buscar ${currentConfig?.plural?.toLowerCase() ?? ''}...`}
                    aria-label={`Buscar ${currentConfig?.plural?.toLowerCase() ?? ''}`}
                    className={cx(controlClass, 'pl-9 pr-9')}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-fg-subtle hover:text-fg"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {activeTab === MODULES.VEHICULOS && currentGestion.hasMore && (
                  <Button size="md" icon={ChevronsDown} onClick={() => currentGestion.loadAll?.()} disabled={currentGestion.loading}>
                    Cargar todos
                  </Button>
                )}
              </div>
            )}

            {esPesadas && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 border-b border-line">
                <Segmented
                  label="Sentido"
                  value={sentidoFiltro}
                  onChange={setSentidoFiltro}
                  options={[
                    { value: null, label: 'Todos' },
                    { value: 'INGRESO', label: '↓ Ingreso', activeClass: 'text-ingreso' },
                    { value: 'SALIDA', label: '↑ Salida', activeClass: 'text-salida' },
                  ]}
                />
                <Segmented
                  label="Fecha"
                  value={anioFiltro ? '__especifico' : fechaFiltro}
                  onChange={(v) => { setFechaFiltro(v); setMesFiltro(null); setAnioFiltro(null); }}
                  options={[
                    { value: null, label: 'Todas' },
                    { value: 'hoy', label: 'Hoy' },
                    { value: 'mes', label: 'Este mes' },
                    { value: 'anio', label: 'Este año' },
                  ]}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-fg-subtle">Período</span>
                  <select
                    value={mesFiltro ?? ''}
                    onChange={e => { setMesFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                    aria-label="Mes"
                    className={cx(controlClass, 'h-8 w-auto text-xs', mesFiltro && 'border-brand-solid')}
                  >
                    <option value="">Mes</option>
                    {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                  <select
                    value={anioFiltro ?? ''}
                    onChange={e => { setAnioFiltro(e.target.value ? parseInt(e.target.value) : null); setFechaFiltro(null); }}
                    aria-label="Año"
                    className={cx(controlClass, 'h-8 w-auto text-xs', anioFiltro && 'border-brand-solid')}
                  >
                    <option value="">Año</option>
                    {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {(mesFiltro || anioFiltro) && (
                    <Button size="sm" variant="ghost" icon={X} onClick={() => { setMesFiltro(null); setAnioFiltro(null); }}>
                      Quitar
                    </Button>
                  )}
                </div>
                {mesFiltro && !anioFiltro && (
                  <p className="w-full text-xs text-fg-subtle">Elegí también el año para filtrar por mes.</p>
                )}
              </div>
            )}

            {currentGestion.loading ? (
              <LoadingState texto={`Cargando ${currentConfig.plural}...`} />
            ) : filteredItems.length > 0 ? (
              <TablaItems
                items={filteredItems}
                tipo={activeTab}
                columnasKeys={columnasKeys}
                columnasLabels={columnasLabels}
                onEditar={currentGestion.abrirModal}
                onEliminar={handleEliminarIndividual}
                onToggleEstado={currentGestion.toggleEstado}
                onSubirPDF={handleSubirPDF}
                onEliminarMultiples={handleEliminarMultiples}
                onGenerarReporte={setPesadasReporte}
                onVerDetalles={setPesadaDetalle}
                onContenedor={setContenedorModal}
                soloLectura={esPesadas}
                hasMore={currentGestion.hasMore}
                loadMore={currentGestion.loadMore}
                loadingMore={currentGestion.loadingMore}
              />
            ) : searchTerm ? (
              <EmptyState
                icon={SearchX}
                title={`Sin resultados para "${searchTerm}"`}
                description="Probá con otra patente, nombre o código."
                action={<Button size="sm" onClick={() => setSearchTerm('')}>Limpiar búsqueda</Button>}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title={esPesadas && filtrosFechaActivos ? 'No hay pesadas con estos filtros' : `Todavía no hay ${currentConfig.plural}`}
                description={esPesadas
                  ? (filtrosFechaActivos ? 'Cambiá el sentido o el período para ver otras operaciones.' : 'Las operaciones aparecen acá al registrar una pesada.')
                  : `Los ${currentConfig.plural} que cargues se listan acá.`}
              />
            )}
          </Card>
        </ProtectedRoute>
      )}

      {/* Modal formulario */}
      {esLista && !esPesadas && currentGestion && (
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
          campos={camposFormulario}
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
    </AppShell>
  );
}
