/**
 * Middleware de Autorización
 *
 * Protege los endpoints verificando que el usuario tenga los permisos necesarios.
 * Se integra con el sistema de autenticación existente basado en localStorage.
 */

import { hasPermission, hasPermissions, PERMISSIONS } from '../config/rolesConfig.js';
import pool from '../config/database.js';

/**
 * Middleware para verificar autenticación básica
 * Extrae el usuario del header o query param (para mantener compatibilidad con el sistema actual)
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Intentar obtener el usuario de múltiples fuentes
    const userId = req.headers['x-user-id'] || req.query.userId;
    const username = req.headers['x-username'] || req.query.username;

    if (!userId && !username) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado. Se requiere autenticación.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Buscar usuario en la base de datos
    let result;
    if (userId) {
      result = await pool.query(
        'SELECT id, username, rol, localidad_id, activo FROM usuario WHERE id = $1 AND activo = true',
        [userId]
      );
    } else {
      result = await pool.query(
        'SELECT id, username, rol, localidad_id, activo FROM usuario WHERE LOWER(username) = LOWER($1) AND activo = true',
        [username]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado o inactivo',
        code: 'USER_NOT_FOUND'
      });
    }

    // Adjuntar usuario al request
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para verificar un permiso específico
 * @param {string} permission - Permiso requerido
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Si no hay usuario autenticado, intentar autenticar primero
      if (!req.user) {
        await new Promise((resolve, reject) => {
          requireAuth(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const { rol } = req.user;

      if (!hasPermission(rol, permission)) {
        return res.status(403).json({
          success: false,
          error: `No tiene permiso para realizar esta acción. Se requiere: ${permission}`,
          code: 'FORBIDDEN',
          requiredPermission: permission,
          currentRole: rol
        });
      }

      next();
    } catch (error) {
      console.error('Error en middleware de permisos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar múltiples permisos
 * @param {string[]} permissions - Array de permisos requeridos
 * @param {string} operator - 'AND' (todos) o 'OR' (al menos uno)
 */
export const requirePermissions = (permissions, operator = 'OR') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        await new Promise((resolve, reject) => {
          requireAuth(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const { rol } = req.user;

      if (!hasPermissions(rol, permissions, operator)) {
        return res.status(403).json({
          success: false,
          error: `No tiene los permisos requeridos. Se requiere${operator === 'AND' ? 'n' : ''}: ${permissions.join(', ')}`,
          code: 'FORBIDDEN',
          requiredPermissions: permissions,
          operator,
          currentRole: rol
        });
      }

      next();
    } catch (error) {
      console.error('Error en middleware de permisos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar acceso a un módulo
 * @param {string} moduleId - ID del módulo
 */
export const requireModuleAccess = (moduleId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        await new Promise((resolve, reject) => {
          requireAuth(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const { rol } = req.user;
      const { hasModuleAccess } = await import('../config/rolesConfig.js');

      if (!hasModuleAccess(rol, moduleId)) {
        return res.status(403).json({
          success: false,
          error: `No tiene acceso al módulo: ${moduleId}`,
          code: 'MODULE_FORBIDDEN',
          module: moduleId,
          currentRole: rol
        });
      }

      next();
    } catch (error) {
      console.error('Error en middleware de acceso a módulo:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware opcional que agrega info del usuario si está disponible
 * pero no bloquea la petición si no lo está
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    const username = req.headers['x-username'] || req.query.username;

    if (userId || username) {
      let result;
      if (userId) {
        result = await pool.query(
          'SELECT id, username, rol, localidad_id, activo FROM usuario WHERE id = $1 AND activo = true',
          [userId]
        );
      } else {
        result = await pool.query(
          'SELECT id, username, rol, localidad_id, activo FROM usuario WHERE LOWER(username) = LOWER($1) AND activo = true',
          [username]
        );
      }

      if (result.rows.length > 0) {
        req.user = result.rows[0];
      }
    }

    next();
  } catch (error) {
    console.error('Error en optionalAuth:', error);
    next();
  }
};

/**
 * Middleware combinado para protección de rutas CRUD estándar
 * @param {string} resource - Prefijo del recurso (ej: 'choferes', 'productos')
 */
export const protectResource = (resource) => {
  const resourceUpper = resource.toUpperCase();

  return {
    // GET / - listar (solo lectura)
    list: [optionalAuth, requirePermission(PERMISSIONS[`${resourceUpper}_VIEW`])],

    // GET /:id - ver detalle (solo lectura)
    get: [optionalAuth, requirePermission(PERMISSIONS[`${resourceUpper}_VIEW`])],

    // POST / - crear
    create: [requireAuth, requirePermission(PERMISSIONS[`${resourceUpper}_CREATE`])],

    // PUT /:id - actualizar
    update: [requireAuth, requirePermission(PERMISSIONS[`${resourceUpper}_UPDATE`])],

    // DELETE /:id - eliminar
    delete: [requireAuth, requirePermission(PERMISSIONS[`${resourceUpper}_DELETE`])],
  };
};

export default {
  requireAuth,
  requirePermission,
  requirePermissions,
  requireModuleAccess,
  optionalAuth,
  protectResource,
};
