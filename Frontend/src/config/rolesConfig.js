/**
 * Configuración de Roles y Permisos - Frontend
 *
 * Replica de la configuración del backend para uso en el frontend.
 * Esto permite controlar la UI según los permisos del usuario.
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

  // Módulo de pesaje (especial)
  PESAJE_VIEW: 'pesaje:view',
  PESAJE_CREATE: 'pesaje:create',
  PESAJE_UPDATE: 'pesaje:update',
  PESAJE_DELETE: 'pesaje:delete',
  PESAJE_MANUAL: 'pesaje:manual',

  // Reportes
  REPORTES_VIEW: 'reportes:view',
  REPORTES_CREATE: 'reportes:create',
  REPORTES_DELETE: 'reportes:delete',

  // Dashboard
  DASHBOARD_VIEW: 'dashboard:view',

  // Tickets
  TICKETS_VIEW: 'tickets:view',
  TICKETS_CREATE: 'tickets:create',
  TICKETS_CLOSE: 'tickets:close',

  // Cámaras
  CAMARAS_VIEW: 'camaras:view',
  CAMARAS_CAPTURE: 'camaras:capture',

  // Respaldos (Backup)
  BACKUP_MANAGE: 'backup:manage',
};

// Definición de roles
export const ROLES = {
  ADMIN: 'admin',
  LOGISTICA: 'logistica',
  GERENTE: 'gerente',
  BALANCERO: 'balancero',
  SUBALANCERO: 'subalancero',
};

// Mapa de permisos por rol (debe coincidir con el backend)
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),

  [ROLES.LOGISTICA]: [
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
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.CAMARAS_VIEW,
  ],

  [ROLES.GERENTE]: [
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
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_CLOSE,
    PERMISSIONS.CAMARAS_VIEW,
    PERMISSIONS.CAMARAS_CAPTURE,
  ],

  [ROLES.BALANCERO]: [
    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.PESAJE_CREATE,
    PERMISSIONS.PESAJE_UPDATE,
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.CAMARAS_VIEW,
    PERMISSIONS.CAMARAS_CAPTURE,
  ],

  [ROLES.SUBALANCERO]: [
    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.PESAJE_CREATE,
    PERMISSIONS.PESAJE_MANUAL,
    PERMISSIONS.PESAJE_UPDATE,
    PERMISSIONS.BACKUP_MANAGE,
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.CAMARAS_VIEW,
    PERMISSIONS.CAMARAS_CAPTURE,
  ],
};

// Módulos disponibles
export const MODULES = {
  DASHBOARD: 'dashboard',
  PESADA: 'pesada',
  PESADAS: 'pesadas',
  CHOFERES: 'choferes',
  PRODUCTORES: 'productores',
  PRODUCTOS: 'productos',
  TRANSPORTES: 'transportes',
  VEHICULOS: 'vehiculos',
  PROVINCIAS: 'provincias',
  LOCALIDADES: 'localidades',
  REPORTES: 'reportes-historial',
  CONFIGURACION: 'configuracion',
};

// Permisos requeridos por módulo
export const MODULE_PERMISSIONS = {
  [MODULES.CONFIGURACION]: [PERMISSIONS.BACKUP_MANAGE],
  [MODULES.DASHBOARD]: [PERMISSIONS.DASHBOARD_VIEW],
  [MODULES.PESADA]: [PERMISSIONS.PESAJE_CREATE],
  [MODULES.PESADAS]: [PERMISSIONS.PESAJE_VIEW],
  [MODULES.CHOFERES]: [PERMISSIONS.CHOFERES_VIEW],
  [MODULES.PRODUCTORES]: [PERMISSIONS.PRODUCTORES_VIEW],
  [MODULES.PRODUCTOS]: [PERMISSIONS.PRODUCTOS_VIEW],
  [MODULES.TRANSPORTES]: [PERMISSIONS.TRANSPORTES_VIEW],
  [MODULES.VEHICULOS]: [PERMISSIONS.VEHICULOS_VIEW],
  [MODULES.PROVINCIAS]: [PERMISSIONS.PROVINCIAS_VIEW],
  [MODULES.LOCALIDADES]: [PERMISSIONS.LOCALIDADES_VIEW],
  [MODULES.REPORTES]: [PERMISSIONS.REPORTES_VIEW],
};

// Helpers
export const hasPermission = (rol, permission) => {
  if (!rol || !permission) return false;
  const normalizedRol = rol.toLowerCase();
  const permissions = ROLE_PERMISSIONS[normalizedRol] || [];
  return permissions.includes(permission);
};

export const hasModuleAccess = (rol, moduleId) => {
  if (!rol || !moduleId) return false;
  const requiredPermissions = MODULE_PERMISSIONS[moduleId] || [];
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some(perm => hasPermission(rol, perm));
};

export const hasPermissions = (rol, permissions, operator = 'OR') => {
  if (!rol || !permissions || permissions.length === 0) return false;
  if (operator === 'AND') {
    return permissions.every(perm => hasPermission(rol, perm));
  }
  return permissions.some(perm => hasPermission(rol, perm));
};

export const getRolePermissions = (rol) => {
  if (!rol) return [];
  const normalizedRol = rol.toLowerCase();
  return ROLE_PERMISSIONS[normalizedRol] || [];
};

export const canWrite = (rol, modulePrefix) => {
  if (!rol || !modulePrefix) return false;
  const writePermissions = [
    `${modulePrefix}:create`,
    `${modulePrefix}:update`,
    `${modulePrefix}:delete`,
  ];
  return writePermissions.some(perm => hasPermission(rol, perm));
};

export const canEditModule = (rol, moduleId) => {
  const modulePrefixes = {
    [MODULES.CHOFERES]: 'choferes',
    [MODULES.PRODUCTORES]: 'productores',
    [MODULES.PRODUCTOS]: 'productos',
    [MODULES.TRANSPORTES]: 'transportes',
    [MODULES.VEHICULOS]: 'vehiculos',
    [MODULES.PROVINCIAS]: 'provincias',
    [MODULES.LOCALIDADES]: 'localidades',
  };
  const prefix = modulePrefixes[moduleId];
  return prefix ? canWrite(rol, prefix) : false;
};

export default {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  MODULES,
  MODULE_PERMISSIONS,
  hasPermission,
  hasModuleAccess,
  hasPermissions,
  getRolePermissions,
  canWrite,
  canEditModule,
};
