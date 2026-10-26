/**
 * Middleware de Autorización
 *
 * El usuario sale de la sesión firmada (cookie httpOnly o Authorization: Bearer),
 * nunca de headers o parámetros que mande el cliente.
 */

import { hasPermission } from '../config/rolesConfig.js';
import pool from '../config/database.js';
import { tokenDeRequest, verificarToken } from '../utils/session.js';

/**
 * Carga un usuario activo por id, con su empresa y localidad.
 */
export const loadUser = async (userId) => {
  if (!Number.isInteger(userId)) return null;
  const result = await pool.query(
    `SELECT u.id, u.username, u.rol, u.localidad_id, u.empresa_id, u.activo,
            l.nombre AS localidad_nombre, e.nombre AS empresa_nombre
     FROM usuario u
     LEFT JOIN localidad l ON l.id = u.localidad_id
     LEFT JOIN empresa e ON e.id = u.empresa_id
     WHERE u.id = $1 AND u.activo = true`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Usuario de la sesión del request (HTTP o upgrade del WebSocket), o null.
 */
export const userFromRequest = async (req) => loadUser(verificarToken(tokenDeRequest(req)));

/**
 * Middleware para verificar autenticación
 */
export const requireAuth = async (req, res, next) => {
  try {
    if (!tokenDeRequest(req)) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado. Se requiere autenticación.',
        code: 'AUTH_REQUIRED'
      });
    }

    const user = await userFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Sesión inválida o vencida. Vuelva a iniciar sesión.',
        code: 'SESSION_INVALID'
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
    const user = await userFromRequest(req);
    if (user) req.user = user;

    next();
  } catch (error) {
    console.error('Error en optionalAuth:', error);
    next();
  }
};

/**
 * Solo usuarios sin localidad fija (admin global de empresa o superadmin).
 * Usar después de requirePermission.
 */
export const requireGlobal = (req, res, next) => {
  if (req.user?.localidad_id) {
    return res.status(403).json({
      success: false,
      error: 'Solo disponible para administradores globales',
      code: 'FORBIDDEN',
    });
  }
  next();
};
