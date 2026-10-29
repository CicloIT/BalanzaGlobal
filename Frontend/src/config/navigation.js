import {
  LayoutDashboard, Scale, ClipboardList, FileBarChart, Truck, IdCard, Route,
  Tractor, Package, MapPin, Map, Building2, Settings, Users,
} from 'lucide-react';

// Menú lateral agrupado. Los ids son los MODULES de rolesConfig; GestionApp
// filtra por permisos qué ítems se muestran.
export const NAV_GROUPS = [
  {
    key: 'operacion',
    label: 'Operación',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Estado operativo de hoy y del mes' },
      { id: 'pesada', label: 'Nueva pesada', icon: Scale, description: 'Registrar bruto o tara con la lectura de la balanza' },
      { id: 'pesadas', label: 'Historial de pesadas', icon: ClipboardList, description: 'Operaciones registradas, carta de porte y reportes' },
      { id: 'reportes-historial', label: 'Reportes', icon: FileBarChart, description: 'Reportes de pesadas generados y reimpresión' },
    ],
  },
  {
    key: 'catalogos',
    label: 'Catálogos',
    items: [
      { id: 'vehiculos', label: 'Vehículos', icon: Truck, description: 'Patentes y tipos de vehículo' },
      { id: 'choferes', label: 'Choferes', icon: IdCard, description: 'Conductores habilitados' },
      { id: 'transportes', label: 'Transportes', icon: Route, description: 'Empresas de transporte' },
      { id: 'productores', label: 'Productores', icon: Tractor, description: 'Productores y titulares de la carga' },
      { id: 'productos', label: 'Productos', icon: Package, description: 'Mercaderías que se pesan' },
    ],
  },
  {
    key: 'administracion',
    label: 'Administración',
    items: [
      { id: 'usuarios', label: 'Usuarios', icon: Users, description: 'Altas, roles, contraseñas y acceso de los usuarios' },
      { id: 'localidades', label: 'Localidades', icon: MapPin, description: 'Sitios de pesaje de la empresa' },
      { id: 'provincias', label: 'Provincias', icon: Map, description: 'Provincias disponibles para las localidades' },
      { id: 'empresas', label: 'Empresas', icon: Building2, description: 'Empresas de la plataforma' },
      { id: 'configuracion', label: 'Configuración', icon: Settings, description: 'Dispositivos, cámaras y respaldos' },
    ],
  },
];

export const NAV_ITEMS = Object.fromEntries(
  NAV_GROUPS.flatMap(g => g.items.map(item => [item.id, { ...item, group: g.label }]))
);

export const ROLE_LABELS = {
  superadmin: 'Superadministrador',
  logistica: 'Logística',
  balancero: 'Balancero',
};
