import pool from '../config/database.js';
import { getScope, localidadEnScope, ScopeError, sendScopeError } from '../utils/scope.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { crearToken, setCookieSesion, clearCookieSesion } from '../utils/session.js';

const PASSWORD_MIN = 6;

const validarPassword = (password) => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    throw new ScopeError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`, 400);
  }
};

// Usuarios visibles: superadmin todos; admin de empresa los de su empresa; admin local los de su localidad
const usuarioScopeSql = (user, startIdx) => {
  const { empresaId, localidadId } = getScope(user);
  const l = `$${startIdx}`;
  const e = `$${startIdx + 1}`;
  return {
    sql: `(${l}::int IS NULL OR u.localidad_id = ${l}) AND (${e}::int IS NULL OR u.empresa_id = ${e})`,
    params: [localidadId, empresaId],
  };
};

const ROLES_GLOBALES = ['superadmin', 'logistica'];

/**
 * Resuelve empresa/localidad/rol permitidos para un alta o edición según quién la hace.
 */
const resolverAsignacion = async (actor, { rol, localidad_id, empresa_id }) => {
  const scope = getScope(actor);
  const rolFinal = rol ? rol.toLowerCase() : undefined;

  if (rolFinal === 'superadmin' && !scope.isSuperadmin) {
    throw new ScopeError('Solo un superadmin puede asignar el rol superadmin');
  }

  if (scope.isSuperadmin) {
    if (rolFinal === 'superadmin') return { rol: rolFinal, empresaId: null, localidadId: null };
    let empresaId = empresa_id ? parseInt(empresa_id, 10) : null;
    const localidadId = localidad_id ? parseInt(localidad_id, 10) : null;
    if (localidadId) {
      const r = await pool.query('SELECT empresa_id FROM localidad WHERE id = $1', [localidadId]);
      if (!r.rows.length) throw new ScopeError('Localidad inexistente', 400);
      empresaId = r.rows[0].empresa_id;
    }
    if (!empresaId) throw new ScopeError('Debe indicar empresa_id o localidad_id', 400);
    return { rol: rolFinal, empresaId, localidadId };
  }

  // Admin local: todo queda en su localidad, sin roles globales
  if (scope.localidadId) {
    if (rolFinal && ROLES_GLOBALES.includes(rolFinal)) {
      throw new ScopeError(`Un admin local no puede asignar el rol ${rolFinal}`);
    }
    return { rol: rolFinal, empresaId: scope.empresaId, localidadId: scope.localidadId };
  }

  // Admin de empresa: cualquier localidad de su empresa, o global dentro de la empresa
  const localidadId = localidad_id ? parseInt(localidad_id, 10) : null;
  if (localidadId && !(await localidadEnScope(actor, localidadId))) {
    throw new ScopeError('La localidad no pertenece a su empresa');
  }
  return { rol: rolFinal, empresaId: scope.empresaId, localidadId };
};

export const getUsuarios = async (req, res) => {
  try {
    const scope = usuarioScopeSql(req.user, 1);
    const result = await pool.query(`
      SELECT u.id, u.username, u.rol, u.localidad_id, l.nombre as localidad_nombre,
             u.empresa_id, e.nombre as empresa_nombre, u.activo, u.created_at
      FROM usuario u
      LEFT JOIN localidad l ON u.localidad_id = l.id
      LEFT JOIN empresa e ON u.empresa_id = e.id
      WHERE u.activo = true AND ${scope.sql}
      ORDER BY u.username ASC
    `, scope.params);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getUsuarioById = async (req, res) => {
  try {
    const scope = usuarioScopeSql(req.user, 2);
    const result = await pool.query(`
      SELECT u.id, u.username, u.rol, u.localidad_id, l.nombre as localidad_nombre,
             u.empresa_id, e.nombre as empresa_nombre, u.activo, u.created_at, u.updated_at
      FROM usuario u
      LEFT JOIN localidad l ON u.localidad_id = l.id
      LEFT JOIN empresa e ON u.empresa_id = e.id
      WHERE u.id = $1 AND ${scope.sql}
    `, [req.params.id, ...scope.params]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createUsuario = async (req, res) => {
  try {
    const { username } = req.body;
    const password = req.body.password ?? req.body.password_hash;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username y password son requeridos' });
    }
    validarPassword(password);
    const asignacion = await resolverAsignacion(req.user, req.body);
    const result = await pool.query(
      `INSERT INTO usuario (username, password_hash, rol, localidad_id, empresa_id, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, username, rol, localidad_id, empresa_id`,
      [username, await hashPassword(password), asignacion.rol || 'balancero', asignacion.localidadId, asignacion.empresaId]
    );
    res.status(201).json({ success: true, message: 'Usuario creado', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    const scope = usuarioScopeSql(req.user, 2);
    const actual = await pool.query(
      `SELECT u.* FROM usuario u WHERE u.id = $1 AND ${scope.sql}`,
      [id, ...scope.params]
    );
    if (actual.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const previo = actual.rows[0];
    const asignacion = await resolverAsignacion(req.user, {
      rol: req.body.rol ?? previo.rol,
      localidad_id: req.body.localidad_id !== undefined ? req.body.localidad_id : previo.localidad_id,
      empresa_id: req.body.empresa_id ?? previo.empresa_id,
    });
    // Reset de contraseña por un admin (opcional)
    let nuevoHash = null;
    if (req.body.password) {
      validarPassword(req.body.password);
      nuevoHash = await hashPassword(req.body.password);
    }
    const result = await pool.query(
      `UPDATE usuario SET
       rol = $1,
       localidad_id = $2,
       empresa_id = $3,
       activo = COALESCE($4, activo),
       password_hash = COALESCE($5, password_hash),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, username, rol, localidad_id, empresa_id, activo`,
      [asignacion.rol, asignacion.localidadId, asignacion.empresaId, activo, nuevoHash, id]
    );
    res.json({ success: true, message: 'Usuario actualizado', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const deleteUsuario = async (req, res) => {
  try {
    const scope = usuarioScopeSql(req.user, 2);
    const result = await pool.query(
      `UPDATE usuario u SET activo = false, updated_at = CURRENT_TIMESTAMP
       WHERE u.id = $1 AND ${scope.sql}
       RETURNING id, username, rol`,
      [req.params.id, ...scope.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario eliminado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Login ──────────────────────────────────────────────────────────────────────
export const authLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos' });
    }
    const result = await pool.query(
      `SELECT u.id, u.username, u.rol, u.localidad_id, l.nombre as localidad_nombre,
              u.empresa_id, e.nombre as empresa_nombre, u.password_hash
       FROM usuario u
       LEFT JOIN localidad l ON u.localidad_id = l.id
       LEFT JOIN empresa e ON u.empresa_id = e.id
       WHERE LOWER(u.username) = LOWER($1) AND u.activo = true`,
      [String(username).trim()]
    );
    const { password_hash, ...user } = result.rows[0] || {};
    const { ok, needsRehash } = await verifyPassword(password, password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    // Contraseña vieja en texto plano: se guarda hasheada en este login
    if (needsRehash) {
      await pool.query('UPDATE usuario SET password_hash = $1 WHERE id = $2', [await hashPassword(password), user.id]);
    }
    setCookieSesion(req, res, crearToken(user.id));
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const authLogout = (req, res) => {
  clearCookieSesion(req, res);
  res.json({ success: true });
};

// Usuario de la sesión actual (el frontend la valida al cargar)
export const getSesion = (req, res) => {
  const { activo, ...user } = req.user;
  res.json({ success: true, user });
};

export const cambiarPasswordPropia = async (req, res) => {
  try {
    const { actual, nueva } = req.body;
    validarPassword(nueva);
    const r = await pool.query('SELECT password_hash FROM usuario WHERE id = $1', [req.user.id]);
    const { ok } = await verifyPassword(actual, r.rows[0]?.password_hash);
    if (!ok) return res.status(400).json({ success: false, error: 'La contraseña actual no es correcta' });
    await pool.query(
      'UPDATE usuario SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [await hashPassword(nueva), req.user.id]
    );
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    sendScopeError(res, error);
  }
};
