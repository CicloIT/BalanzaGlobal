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

  // Empresas (solo superadmin de plataforma)
  EMPRESAS_VIEW: 'empresas:view',
  EMPRESAS_CREATE: 'empresas:create',
  EMPRESAS_UPDATE: 'empresas:update',
  EMPRESAS_DELETE: 'empresas:delete',

  // Módulo de pesaje (especial)
  PESAJE_VIEW: 'pesaje:view',
  PESAJE_CREATE: 'pesaje:create',
  PESAJE_UPDATE: 'pesaje:update',
  PESAJE_DELETE: 'pesaje:delete',
  PESAJE_MANUAL: 'pesaje:manual',
  PESAJE_EDITAR_PESO: 'pesaje:editar_peso', // Corregir el peso de una pesada ya registrada

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

// Roles en uso. Los valores admin, gerente y subalancero siguen existiendo en el enum de la
// base (usuarios viejos), pero sin permisos: esos usuarios quedaron desactivados.
export const ROLES = {
  SUPERADMIN: 'superadmin',
  LOGISTICA: 'logistica',
  BALANCERO: 'balancero',
};

// Mapa de permisos por rol (debe coincidir con el backend)
export const ROLE_PERMISSIONS = {
  // Único administrador: todo (empresas, usuarios, catálogos, dispositivos, respaldos)
  [ROLES.SUPERADMIN]: Object.values(PERMISSIONS),

  // Global, solo métricas: ve el dashboard de todas las localidades de su empresa.
  // LOCALIDADES_VIEW es para el filtro por localidad del dashboard.
  [ROLES.LOGISTICA]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LOCALIDADES_VIEW,
  ],

  // Uno por localidad: pesaje de su balanza (incluido peso manual, queda marcado como manual).
  // Puede dar de alta catálogos desde la pesada, pero no editarlos ni borrarlos.
  [ROLES.BALANCERO]: [
    PERMISSIONS.PESAJE_VIEW,
    PERMISSIONS.PESAJE_CREATE,
    PERMISSIONS.PESAJE_UPDATE,
    PERMISSIONS.PESAJE_MANUAL,
    PERMISSIONS.CHOFERES_VIEW,
    PERMISSIONS.CHOFERES_CREATE,
    PERMISSIONS.PRODUCTORES_VIEW,
    PERMISSIONS.PRODUCTORES_CREATE,
    PERMISSIONS.PRODUCTOS_VIEW,
    PERMISSIONS.PRODUCTOS_CREATE,
    PERMISSIONS.TRANSPORTES_VIEW,
    PERMISSIONS.TRANSPORTES_CREATE,
    PERMISSIONS.VEHICULOS_VIEW,
    PERMISSIONS.VEHICULOS_CREATE,
    PERMISSIONS.REPORTES_CREATE,
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
  EMPRESAS: 'empresas',
};

// Permisos requeridos por módulo
export const MODULE_PERMISSIONS = {
  [MODULES.EMPRESAS]: [PERMISSIONS.EMPRESAS_VIEW],
  [MODULES.CONFIGURACION]: [PERMISSIONS.BACKUP_MANAGE, PERMISSIONS.DISPOSITIVOS_MANAGE],
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
    [MODULES.EMPRESAS]: 'empresas',
  };
  const prefix = modulePrefixes[moduleId];
  return prefix ? canWrite(rol, prefix) : false;
};
