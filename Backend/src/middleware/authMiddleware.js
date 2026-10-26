/**
 * Middleware de Autorización
 *
 * Protege los endpoints verificando que el usuario tenga los permisos necesarios.
 * Se integra con el sistema de autenticación existente basado en localStorage.
 */

import { hasPermission } from '../config/rolesConfig.js';
import pool from '../config/database.js';

/**
 * Carga un usuario activo por id o username, con su empresa y localidad.
 * Usado por los middlewares HTTP y por el handshake del WebSocket.
 */
export const loadUser = async ({ userId, username }) => {
  if (!userId && !username) return null;
  const byId = !!userId;
  if (byId && !/^\d+$/.test(String(userId))) return null;
  const result = await pool.query(
    `SELECT u.id, u.username, u.rol, u.localidad_id, u.empresa_id, u.activo,
            l.nombre AS localidad_nombre, e.nombre AS empresa_nombre
     FROM usuario u
     LEFT JOIN localidad l ON l.id = u.localidad_id
     LEFT JOIN empresa e ON e.id = u.empresa_id
     WHERE ${byId ? 'u.id = $1' : 'LOWER(u.username) = LOWER($1)'} AND u.activo = true`,
    [byId ? userId : username]
  );
  return result.rows[0] || null;
};

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
    const user = await loadUser({ userId, username });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado o inactivo',
        code: 'USER_NOT_FOUND'
      });
    }

    // Adjuntar usuario al request
    req.user = user;
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
 * Middleware opcional que agrega info del usuario si está disponible
 * pero no bloquea la petición si no lo está
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    const username = req.headers['x-username'] || req.query.username;

    if (userId || username) {
      const user = await loadUser({ userId, username });
      if (user) req.user = user;
    }

    next();
  } catch (error) {
    console.error('Error en optionalAuth:', error);
    next();
  }
};
