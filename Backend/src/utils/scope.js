/**
 * Alcance de datos por empresa / localidad
 *
 *  superadmin            → empresa NULL, localidad NULL → ve todo
 *  admin/logistica glob. → empresa E,    localidad NULL → todas las localidades de E
 *  usuario local         → empresa E,    localidad L    → solo L
 */
import pool from '../config/database.js';

export class ScopeError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

export const getScope = (user) => ({
  empresaId: user?.empresa_id ?? null,
  localidadId: user?.localidad_id ?? null,
  isSuperadmin: user?.rol?.toLowerCase() === 'superadmin',
});

/**
 * Fragmento SQL que restringe `${col}` (una columna localidad_id) al alcance del usuario.
 * @param {string} col - columna calificada, ej: 'c.localidad_id'
 * @param {object} user - req.user
 * @param {number} startIdx - índice del primer placeholder ($n) a usar
 * @returns {{ sql: string, params: any[] }}
 */
export const scopeSql = (col, user, startIdx) => {
  const { empresaId, localidadId } = getScope(user);
  const l = `$${startIdx}`;
  const e = `$${startIdx + 1}`;
  return {
    sql: `(${l}::int IS NULL OR ${col} = ${l}) AND (${e}::int IS NULL OR ${col} IN (SELECT id FROM localidad WHERE empresa_id = ${e}))`,
    params: [localidadId, empresaId],
  };
};

/**
 * Igual que scopeSql pero con los ids embebidos (enteros forzados con parseInt).
 * Para consultas con muchos fragmentos donde numerar placeholders no aporta (métricas).
 */
export const scopeSqlLiteral = (col, user) => {
  const { empresaId, localidadId } = getScope(user);
  const parts = [];
  if (localidadId) parts.push(`${col} = ${parseInt(localidadId, 10)}`);
  if (empresaId) parts.push(`${col} IN (SELECT id FROM localidad WHERE empresa_id = ${parseInt(empresaId, 10)})`);
  return parts.length ? parts.join(' AND ') : 'TRUE';
};

/** Verifica que una localidad esté dentro del alcance del usuario. */
export const localidadEnScope = async (user, localidadId) => {
  if (!localidadId) return false;
  const { sql, params } = scopeSql('id', user, 2);
  const r = await pool.query(`SELECT 1 FROM localidad WHERE id = $1 AND ${sql}`, [localidadId, ...params]);
  return r.rows.length > 0;
};

/**
 * Localidad a usar en un INSERT.
 * Usuario local: siempre la suya. Usuario global: la del body (o query), validada contra su empresa.
 */
export const resolveLocalidadForWrite = async (req, requested) => {
  const user = req.user;
  if (user?.localidad_id) return user.localidad_id;
  const localidadId = parseInt(requested ?? req.body?.localidad_id ?? req.query?.localidad_id, 10);
  if (!localidadId) throw new ScopeError('Debe indicar localidad_id', 400);
  if (!(await localidadEnScope(user, localidadId))) {
    throw new ScopeError('La localidad no pertenece a su empresa');
  }
  return localidadId;
};

/**
 * Filtro de lectura opcional: un usuario global puede acotar a una localidad con ?localidad_id=.
 * Devuelve un "usuario efectivo" para pasar a scopeSql.
 */
export const userForRead = (req) => {
  const requested = parseInt(req.query?.localidad_id, 10);
  if (!req.user || req.user.localidad_id || !requested) return req.user;
  return { ...req.user, localidad_id: requested };
};

export const sendScopeError = (res, error) => {
  const status = error instanceof ScopeError ? error.status : 500;
  return res.status(status).json({ success: false, error: error.message, message: error.message });
};

// Nombre de la localidad como slug para carpetas (capturas, backups); null si no hay localidad
export const slugLocalidadPorId = async (localidadId) => {
  if (!localidadId) return null;
  const result = await pool.query('SELECT nombre FROM localidad WHERE id = $1', [localidadId]);
  if (!result.rows.length) return null;
  return result.rows[0].nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
};
