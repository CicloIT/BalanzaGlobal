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

// Mapa de permisos por rol
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

// Helper para verificar si un rol tiene un permiso
export const hasPermission = (rol, permission) => {
  if (!rol || !permission) return false;
  const normalizedRol = rol.toLowerCase();
  const permissions = ROLE_PERMISSIONS[normalizedRol] || [];
  return permissions.includes(permission);
};
