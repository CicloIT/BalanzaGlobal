/**
 * Configuración de Roles y Permisos del Sistema
 *
 * Estructura escalable que permite:
 * - Definir múltiples roles
 * - Asignar permisos granulares por rol
 * - Agregar nuevos roles/permisos sin modificar código existente
 */

// Permisos disponibles en el sistema
export const PERMISSIONS = {
  // Módulos de gestión (CRUD)
  USUARIOS_VIEW: 'usuarios:view',
  USUARIOS_CREATE: 'usuarios:create',
  USUARIOS_UPDATE: 'usuarios:update',
  USUARIOS_DELETE: 'usuarios:delete',

  CHOFERES_VIEW: 'choferes:view',
  CHOFERES_CREATE: 'choferes:create',
  CHOFERES_UPDATE: 'choferes:update',
  CHOFERES_DELETE: 'choferes:delete',

  PRODUCTORES_VIEW: 'productores:view',
  PRODUCTORES_CREATE: 'productores:create',
  PRODUCTORES_UPDATE: 'productores:update',
  PRODUCTORES_DELETE: 'productores:delete',

  PRODUCTOS_VIEW: 'productos:view',
  PRODUCTOS_CREATE: 'productos:create',
  PRODUCTOS_UPDATE: 'productos:update',
  PRODUCTOS_DELETE: 'productos:delete',

  TRANSPORTES_VIEW: 'transportes:view',
  TRANSPORTES_CREATE: 'transportes:create',
  TRANSPORTES_UPDATE: 'transportes:update',
  TRANSPORTES_DELETE: 'transportes:delete',

  VEHICULOS_VIEW: 'vehiculos:view',
  VEHICULOS_CREATE: 'vehiculos:create',
  VEHICULOS_UPDATE: 'vehiculos:update',
  VEHICULOS_DELETE: 'vehiculos:delete',

  PROVINCIAS_VIEW: 'provincias:view',
  PROVINCIAS_CREATE: 'provincias:create',
  PROVINCIAS_UPDATE: 'provincias:update',
  PROVINCIAS_DELETE: 'provincias:delete',

  LOCALIDADES_VIEW: 'localidades:view',
  LOCALIDADES_CREATE: 'localidades:create',
  LOCALIDADES_UPDATE: 'localidades:update',
  LOCALIDADES_DELETE: 'localidades:delete',

  // Empresas (solo superadmin de plataforma)
  EMPRESAS_VIEW: 'empresas:view',
  EMPRESAS_CREATE: 'empresas:create',
  EMPRESAS_UPDATE: 'empresas:update',
  EMPRESAS_DELETE: 'empresas:delete',

  // Módulo de pesaje (especial)
  PESAJE_VIEW: 'pesaje:view',           // Ver historial de pesadas
  PESAJE_CREATE: 'pesaje:create',       // Crear nueva pesada
  PESAJE_UPDATE: 'pesaje:update',       // Modificar pesada existente
  PESAJE_DELETE: 'pesaje:delete',       // Eliminar pesada
  PESAJE_MANUAL: 'pesaje:manual',       // Cargar peso manualmente (input libre)

  // Reportes
  REPORTES_VIEW: 'reportes:view',
  REPORTES_CREATE: 'reportes:create',
  REPORTES_DELETE: 'reportes:delete',

  // Dashboard
  DASHBOARD_VIEW: 'dashboard:view',


  // Cámaras
  CAMARAS_VIEW: 'camaras:view',
  CAMARAS_CAPTURE: 'camaras:capture',

  // Respaldos (Backup)
  BACKUP_MANAGE: 'backup:manage',

  // Dispositivos (ip/puerto, tokens de agente) — solo admin y superadmin
  DISPOSITIVOS_MANAGE: 'dispositivos:manage',
};

// Definición de roles y sus permisos
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  LOGISTICA: 'logistica',
  GERENTE: 'gerente',
  BALANCERO: 'balancero',
  SUBALANCERO: 'subalancero',
};

// Mapa de permisos por rol
export const ROLE_PERMISSIONS = {
  // Superadmin de plataforma: todo, incluidas las empresas
  [ROLES.SUPERADMIN]: Object.values(PERMISSIONS),

  // Admin de empresa: todo salvo administrar empresas
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter(p => !p.startsWith('empresas:')),

  [ROLES.LOGISTICA]: [
    // Global, solo lectura — ve todo pero no puede crear/editar/borrar nada
    PERMISSIONS.USUARIOS_VIEW,
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.PROVINCIAS_VIEW,
    PERMISSIONS.LOCALIDADES_VIEW,
    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.REPORTES_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CAMARAS_VIEW,
  ],

  [ROLES.GERENTE]: [
    // Local por localidad — gestiona su localidad, sin pesajes ni usuarios ni config
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.CHOFERES_CREATE,
    PERMISSIONS.CHOFERES_UPDATE,
    PERMISSIONS.CHOFERES_DELETE,

    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTORES_CREATE,
    PERMISSIONS.PRODUCTORES_UPDATE,
    PERMISSIONS.PRODUCTORES_DELETE,

    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.PRODUCTOS_CREATE,
    PERMISSIONS.PRODUCTOS_UPDATE,
    PERMISSIONS.PRODUCTOS_DELETE,

    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.TRANSPORTES_CREATE,
    PERMISSIONS.TRANSPORTES_UPDATE,
    PERMISSIONS.TRANSPORTES_DELETE,

    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.VEHICULOS_CREATE,
    PERMISSIONS.VEHICULOS_UPDATE,
    PERMISSIONS.VEHICULOS_DELETE,

    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.REPORTES_VIEW,
    PERMISSIONS.REPORTES_CREATE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CAMARAS_VIEW,
    PERMISSIONS.CAMARAS_CAPTURE,
  ],

  [ROLES.BALANCERO]: [
    // Acceso solo al módulo de pesaje
    // Puede crear y visualizar pesajes
    // NO puede cargar peso manualmente

    // Pesaje (ver y crear, sin manual)
    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.PESAJE_CREATE,
    PERMISSIONS.PESAJE_UPDATE,
    // Catálogos (solo lectura - necesarios para el formulario)
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.REPORTES_CREATE,
    // Cámaras (para captura automática)
    PERMISSIONS.CAMARAS_VIEW,
    PERMISSIONS.CAMARAS_CAPTURE,
  ],

  [ROLES.SUBALANCERO]: [
    // Mismos permisos que balancero + puede cargar peso manualmente

    // Pesaje (ver, crear, y manual)
    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.PESAJE_CREATE,
    PERMISSIONS.PESAJE_MANUAL,
    PERMISSIONS.PESAJE_UPDATE,
    // Backup (respaldos)
    PERMISSIONS.BACKUP_MANAGE,
    // Catálogos (solo lectura)
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.REPORTES_CREATE,
    // Cámaras
    PERMISSIONS.CAMARAS_VIEW,
    PERMISSIONS.CAMARAS_CAPTURE,
  ],
};

// Helper para verificar si un rol tiene un permiso
export const hasPermission = (rol, permission) => {
  if (!rol || !permission) return false;
  const normalizedRol = rol.toLowerCase();
  const permissions = ROLE_PERMISSIONS[normalizedRol] || [];
  return permissions.includes(permission);
};
